/**
 * API routes for TrustDrop.
 *
 * Security design: read endpoints (meta, consume) return identical 404
 * responses for non-existent, invalid-token, expired, and consumed drops.
 * This uniform error pattern prevents existence leakage — an attacker
 * cannot distinguish "drop doesn't exist" from "wrong access token."
 *
 * Write endpoints (confirm, burn) return neutral success responses (200)
 * regardless of whether the drop exists or the token is valid, also
 * preventing existence leakage through a different mechanism.
 */
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { createDropSchema, createBlogPostSchema, updateBlogPostSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { log } from "./index";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { blogUploadsEnabled, registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import rateLimit from "express-rate-limit";

/**
 * Rate limiting configuration.
 *
 * Tiered limits protect different endpoints based on abuse risk:
 * - Drop creation: strictest limit (storage abuse vector)
 * - Admin login: strict limit (brute-force prevention)
 * - Drop retrieval: moderate limit (meta/consume/confirm/burn)
 * - General API: catch-all safety net for all other endpoints
 *
 * All limiters use the in-memory store (suitable for single-server deployment).
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 *
 * Rate limits use the address resolved by Express's trust proxy setting.
 */
const parseForm = express.urlencoded({ extended: false });
const parseSmallBody = [express.json(), parseForm];
const parseBlogBody = [express.json({ limit: "1mb" }), parseForm];

// Drop creation — 50 requests per 15 minutes per IP
const dropCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many drops created. Please try again later." },
});

// Admin login — 25 attempts per 15 minutes per IP (brute-force prevention)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

// Drop retrieval — 150 requests per 15 minutes per IP (meta/consume/confirm/burn)
const dropRetrieveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// General API — 500 requests per 15 minutes per IP (catch-all safety net)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  /**
   * Security headers middleware.
   * X-Content-Type-Options: nosniff — prevents MIME sniffing attacks.
   * Referrer-Policy: no-referrer — prevents access tokens in query params
   * from leaking via HTTP Referer headers to external sites.
   */
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use("/api", (req, res, next) => {
    if (req.method === "POST" && /^\/drops\/?$/i.test(req.path)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    next();
  }, generalApiLimiter);

  // CORS preflight + headers for POST /api/drops only (embeddable widget)
  app.options("/api/drops", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(204);
  });

  // Register object storage routes for OG image uploads (admin-protected)
  app.use("/objects/uploads", generalApiLimiter);
  registerObjectStorageRoutes(app, parseSmallBody);

  /**
   * POST /api/drops — Creates a new encrypted drop.
   * Server receives only ciphertext (already encrypted client-side) and metadata.
   * The encryption key exists only in the URL fragment returned to the creator —
   * it never touches the server (URL fragments are not sent in HTTP requests).
   */
  app.post("/api/drops", dropCreateLimiter, express.json({ limit: "75mb" }), parseForm, async (req, res) => {
    try {
      const parsed = createDropSchema.safeParse(req.body);
      if (!parsed.success) {
        const validationError = fromError(parsed.error);
        return res.status(400).json({ error: validationError.toString() });
      }

      const { ciphertext_b64, meta, expires_in_seconds, max_views, burn_on_fail } = parsed.data;
      const { id, accessToken } = await storage.createDrop(
        ciphertext_b64,
        meta,
        expires_in_seconds,
        max_views ?? 1,
        burn_on_fail ?? true
      );

      return res.json({ id, accessToken });
    } catch {
      log("Error creating drop");
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/drops/:id/meta — Lightweight metadata check.
   * Returns metadata (type, password requirement, view counts) without the ciphertext.
   * Used by the retrieve page to show the correct UI before attempting decryption.
   * Returns uniform 404 for missing, expired, or invalid-token requests.
   */
  app.get("/api/drops/:id/meta", dropRetrieveLimiter, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const token = String(req.query.t || "");

      if (!token) {
        return res.status(404).json({ error: "consumed_or_expired" });
      }

      const result = await storage.getDropMeta(id, token);

      if (!result) {
        return res.status(404).json({ error: "consumed_or_expired" });
      }

      return res.json({
        meta: result.meta,
        maxViews: result.maxViews,
        viewCount: result.viewCount,
      });
    } catch {
      log("Error getting drop meta");
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/drops/:id/consume — Charges a view before releasing ciphertext.
   * The client decrypts locally.
   */
  app.post("/api/drops/:id/consume", dropRetrieveLimiter, ...parseSmallBody, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const id = req.params.id as string;
      const token = String(req.query.t || req.body?.t || "");

      if (!token) {
        return res.status(404).json({ error: "consumed_or_expired" });
      }

      const result = await storage.consumeDrop(id, token);

      if (!result) {
        return res.status(404).json({ error: "consumed_or_expired" });
      }

      return res.json({
        ciphertext_b64: result.ciphertext_b64,
        meta: result.meta,
        maxViews: result.maxViews,
        viewCount: result.viewCount,
      });
    } catch {
      log("Error fetching drop");
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Legacy clients still call /confirm. Return remaining views without charging again.
   */
  app.post("/api/drops/:id/confirm", dropRetrieveLimiter, ...parseSmallBody, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const token = String(req.query.t || req.body?.t || "");

      if (!token) {
        return res.json({ remainingViews: 0 });
      }

      const result = await storage.getDropMeta(id, token);

      if (!result) {
        return res.json({ remainingViews: 0 });
      }

      return res.json({ remainingViews: Math.max(0, result.maxViews - result.viewCount) });
    } catch {
      log("Error confirming view");
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/drops/:id/burn — Emergency destroy endpoint.
   * Called when decryption fails and burn_on_fail is enabled.
   * The server can only act on a failure reported by the browser.
   */
  app.post("/api/drops/:id/burn", dropRetrieveLimiter, ...parseSmallBody, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const token = String(req.query.t || req.body?.t || "");

      if (!token) {
        return res.json({ burned: false });
      }

      const burned = await storage.burnDrop(id, token);

      return res.json({ burned });
    } catch {
      log("Error burning drop");
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/stats — Public endpoint returning aggregate drop count. No sensitive data exposed. */
  app.get("/api/stats", async (_req, res) => {
    try {
      const totalDrops = await storage.getTotalDrops();
      return res.json({ totalDrops });
    } catch (error: any) {
      log(`Error getting stats: ${error.message}`);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Admin Authentication & Blog CRUD ---

  /** Middleware to verify admin session. Returns 401 if not authenticated. */
  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.session && req.session.isAdmin) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  /**
   * Check admin setup status. Returns whether admin account has been
   * configured (password + TOTP). Used by frontend to show setup vs login flow.
   */
  app.get("/api/admin/status", async (_req, res) => {
    try {
      const config = await storage.getAdminConfig();
      const isSetup = !!(config && config.passwordHash && config.totpSecret);
      return res.json({ isSetup });
    } catch {
      log("Admin status error");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Initial admin setup — creates password hash and TOTP secret.
   * Only works if admin is not yet configured. Requires ADMIN_SETUP_TOKEN
   * environment variable to match the setupToken in the request body.
   * This prevents unauthorized users from claiming admin on a fresh deployment.
   */
  app.post("/api/admin/setup", ...parseSmallBody, async (req, res) => {
    try {
      const existing = await storage.getAdminConfig();
      if (existing && existing.passwordHash) {
        return res.status(400).json({ message: "Admin already configured" });
      }

      // Require setup token from environment to prevent unauthorized admin creation
      const expectedToken = process.env.ADMIN_SETUP_TOKEN;
      if (!expectedToken) {
        return res.status(403).json({ message: "Admin setup is disabled. Set ADMIN_SETUP_TOKEN environment variable to enable." });
      }
      const { setupToken } = req.body;
      if (!setupToken || setupToken !== expectedToken) {
        return res.status(403).json({ message: "Invalid setup token" });
      }

      const { password } = req.body;
      if (!password || typeof password !== "string" || password.length < 12) {
        return res.status(400).json({ message: "Password must be at least 12 characters" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const secret = generateSecret();
      const uri = generateURI({ secret, issuer: "TrustDrop", label: "admin", algorithm: "sha1", digits: 6, period: 30 });
      const qrCodeDataUrl = await QRCode.toDataURL(uri);

      await storage.setAdminConfig(passwordHash, secret);

      return res.json({ qrCodeDataUrl, totpSecret: secret });
    } catch {
      log("Admin setup error");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Admin login — validates password + TOTP code.
   * Creates a session on success. Rate limited to 5 attempts per 15 minutes.
   */
  app.post("/api/admin/login", adminLoginLimiter, ...parseSmallBody, async (req, res) => {
    try {
      const config = await storage.getAdminConfig();
      if (!config || !config.passwordHash || !config.totpSecret) {
        return res.status(400).json({ message: "Admin not configured" });
      }

      const { password, totpCode } = req.body;

      const passwordValid = await bcrypt.compare(password || "", config.passwordHash);
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (
        typeof totpCode !== "string" ||
        totpCode.length !== 6 ||
        /\D/.test(totpCode) ||
        verifySync({ secret: config.totpSecret, token: totpCode }).valid !== true
      ) {
        return res.status(401).json({ message: "Invalid TOTP code" });
      }

      req.session.isAdmin = true;
      return res.json({ success: true });
    } catch {
      log("Admin login error");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  /** Admin session check — returns whether the current session is authenticated. */
  app.get("/api/admin/session", (req, res) => {
    if (!req.session?.isAdmin) return res.json({ isAdmin: false });
    return res.json({ isAdmin: true, blogUploadsEnabled });
  });

  /** Admin logout — destroys the session. */
  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // --- Blog CRUD (admin-protected) ---

  /** List all blog posts (admin sees all, including drafts). */
  app.get("/api/admin/blog", requireAdmin, async (_req, res) => {
    try {
      const posts = await storage.listBlogPosts(false);
      return res.json(posts);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  /** Create a new blog post. Validates with Zod schema. */
  app.post("/api/admin/blog", requireAdmin, ...parseBlogBody, async (req, res) => {
    try {
      const parsed = createBlogPostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromError(parsed.error).toString() });
      }
      const post = await storage.createBlogPost(parsed.data);
      return res.status(201).json(post);
    } catch (error: any) {
      if (error.message?.includes("unique")) {
        return res.status(409).json({ message: "A post with this slug already exists" });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  /** Get a single blog post by ID (admin). */
  app.get("/api/admin/blog/:id", requireAdmin, async (req, res) => {
    try {
      const post = await storage.getBlogPostById(req.params.id as string);
      if (!post) return res.status(404).json({ message: "Post not found" });
      return res.json(post);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  /** Update a blog post by ID. Validates with partial Zod schema. */
  app.patch("/api/admin/blog/:id", requireAdmin, ...parseBlogBody, async (req, res) => {
    try {
      const parsed = updateBlogPostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromError(parsed.error).toString() });
      }
      const post = await storage.updateBlogPost(req.params.id as string, parsed.data);
      if (!post) return res.status(404).json({ message: "Post not found" });
      return res.json(post);
    } catch (error: any) {
      if (error.message?.includes("unique")) {
        return res.status(409).json({ message: "A post with this slug already exists" });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  /** Delete a blog post by ID. */
  app.delete("/api/admin/blog/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteBlogPost(req.params.id as string);
      if (!deleted) return res.status(404).json({ message: "Post not found" });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // --- Public Blog API ---

  /** List published blog posts (public). */
  app.get("/api/blog", async (_req, res) => {
    try {
      const posts = await storage.listBlogPosts(true);
      return res.json(posts);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  /** Get a single published blog post by slug (public). */
  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post || post.published !== 1) {
        return res.status(404).json({ message: "Post not found" });
      }
      return res.json(post);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  /** RSS feed for published blog posts. Enables RSS readers and feed aggregators. */
  app.get("/blog/feed.xml", async (_req, res) => {
    try {
      const posts = await storage.listBlogPosts(true);
      const items = posts.map((post) => {
        const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : "";
        return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>https://trustdrop.com/blog/${post.slug}</link>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${pubDate}</pubDate>
      <guid>https://trustdrop.com/blog/${post.slug}</guid>
    </item>`;
      }).join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>TrustDrop Blog</title>
    <link>https://trustdrop.com/blog</link>
    <description>Insights on privacy, encryption, and secure communication.</description>
    <language>en-us</language>${items}
  </channel>
</rss>`;

      return res.status(200).set({ "Content-Type": "application/rss+xml" }).end(xml);
    } catch {
      return res.status(500).end();
    }
  });

  /**
   * OG tag override for blog posts — serves post-specific meta tags to crawlers.
   * Each post gets its own title, description, and optional OG image.
   * Must be registered AFTER feed.xml to prevent slug matching "feed.xml".
   */
  app.get("/blog/:slug", async (req, res, next) => {
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isCrawler =
      ua.includes("slackbot") || ua.includes("twitterbot") ||
      ua.includes("facebookexternalhit") || ua.includes("linkedinbot") ||
      ua.includes("discordbot") || ua.includes("whatsapp") ||
      ua.includes("telegrambot") || ua.includes("googlebot") ||
      ua.includes("bingbot") || ua.includes("applebot");

    if (!isCrawler) return next();

    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post || post.published !== 1) return next();

      const fullUrl = `https://trustdrop.com/blog/${post.slug}`;
      const ogImageRaw = post.ogImageUrl || "";
      const ogImage = (
        ogImageRaw.startsWith("/") && !ogImageRaw.startsWith("//")
          ? `https://trustdrop.com${ogImageRaw}`
          : ogImageRaw || "https://trustdrop.com/og-image.png"
      ).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const escapedTitle = post.title.replace(/"/g, "&quot;");
      const escapedExcerpt = post.excerpt.replace(/"/g, "&quot;");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedExcerpt}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapedTitle}" />
  <meta name="twitter:description" content="${escapedExcerpt}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta name="description" content="${escapedExcerpt}" />
  <title>${escapedTitle} - TrustDrop Blog</title>
</head>
<body></body>
</html>`;

      return res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch {
      return next();
    }
  });

  /**
   * OG tag override for drop links — serves recipient-focused meta tags to
   * social media crawlers (Slack, Twitter, Facebook, LinkedIn, Discord, etc.).
   * Regular browsers get the normal SPA from the Vite/static handler.
   *
   * This is needed because crawlers don't execute JavaScript, so they only see
   * the raw HTML meta tags. Without this, every shared TrustDrop link would
   * show the generic homepage preview instead of a recipient-focused message.
   */
  app.get("/d/:id", (req, res, next) => {
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isCrawler =
      ua.includes("slackbot") ||
      ua.includes("twitterbot") ||
      ua.includes("facebookexternalhit") ||
      ua.includes("linkedinbot") ||
      ua.includes("discordbot") ||
      ua.includes("whatsapp") ||
      ua.includes("telegrambot") ||
      ua.includes("googlebot") ||
      ua.includes("bingbot") ||
      ua.includes("embedly") ||
      ua.includes("outbrain") ||
      ua.includes("pinterest") ||
      ua.includes("applebot");

    if (!isCrawler) {
      return next();
    }

    const fullUrl = `https://trustdrop.com${req.originalUrl}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:title" content="A secret has been shared with you" />
  <meta property="og:description" content="Open this link to decrypt your message. This secret will self-destruct after viewing." />
  <meta property="og:image" content="https://trustdrop.com/og-image-drop.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="A secret has been shared with you" />
  <meta name="twitter:description" content="Open this link to decrypt your message. This secret will self-destruct after viewing." />
  <meta name="twitter:image" content="https://trustdrop.com/og-image-drop.png" />
  <meta name="description" content="Open this link to decrypt your message. This secret will self-destruct after viewing." />
  <meta name="referrer" content="no-referrer" />
  <title>A secret has been shared with you - TrustDrop</title>
</head>
<body></body>
</html>`;

    return res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });

  // Cleanup interval: runs every 60 seconds to remove expired drops.
  // This is the background enforcement of time-based burn rules.
  setInterval(async () => {
    try {
      const count = await storage.cleanupExpired();
      if (count > 0) {
        log(`Cleaned up ${count} expired drops`);
      }
    } catch (error: any) {
      log(`Error cleaning up expired drops: ${error.message}`);
    }
  }, 60000);

  return httpServer;
}
