/**
 * Database schema and validation for TrustDrop's zero-knowledge secret sharing system.
 * The server never has access to plaintext secrets or encryption keys — it only stores
 * ciphertext and the parameters needed for client-side decryption.
 */
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Stored alongside ciphertext — contains only encryption parameters (IV, salt) and
 * content metadata. Never contains plaintext or keys. These values are safe to store
 * server-side because they cannot be used to derive the encryption key without the
 * password or key material that only the client possesses.
 */
export interface DropMeta {
  iv: string;           // Initialization vector for AES-GCM decryption
  salt?: string;        // PBKDF2 salt for password-derived keys (absent if no password)
  hasPassword: boolean; // Whether the drop requires a password for decryption
  type: "text" | "file";
  mime?: string;        // MIME type for file drops (used for client-side download)
  filename?: string;    // Original filename for file drops
  size?: number;        // Original file size in bytes
}

export const drops = pgTable("drops", {
  // 128-bit cryptographically random identifier (22 char base64url).
  // Brute-force infeasible (~3.4×10^38 possibilities).
  id: varchar("id", { length: 36 }).primaryKey(),

  // Separate 128-bit token required for all operations. Defense-in-depth:
  // prevents unauthorized access even if drop ID is known or guessed.
  accessToken: varchar("access_token", { length: 44 }).notNull(),

  // Server stores ONLY encrypted data. The server cannot decrypt this —
  // the key never touches the server (exists only in the URL fragment).
  ciphertextB64: text("ciphertext_b64").notNull(),

  // Encryption parameters needed for client-side decryption (IV, salt).
  // These are safe to store server-side as they don't reveal the key.
  meta: jsonb("meta").$type<DropMeta>().notNull(),

  // Time-based burn rule. Cleanup job removes expired drops every 60 seconds.
  expiresAt: timestamp("expires_at").notNull(),

  // View-based burn rule (1-100). Drop is permanently deleted when this limit is reached.
  maxViews: integer("max_views").notNull().default(1),

  // Tracks successful decryptions only (via two-step consume flow).
  // Failed decryptions don't increment — views are only counted after client confirms.
  viewCount: integer("view_count").notNull().default(0),

  // Anti-brute-force kill switch. If enabled (1), a wrong password attempt
  // permanently destroys the drop. No recovery possible.
  burnOnFail: integer("burn_on_fail").notNull().default(1),
});

/** Zod validation for incoming drop creation requests. */
export const createDropSchema = z.object({
  ciphertext_b64: z.string().min(1),
  meta: z.object({
    iv: z.string(),
    salt: z.string().optional(),
    hasPassword: z.boolean(),
    type: z.enum(["text", "file"]),
    mime: z.string().optional(),
    filename: z.string().optional(),
    size: z.number().optional(),
  }),
  // Max 2592000 seconds = 30 days. Drops cannot persist beyond this limit.
  expires_in_seconds: z.number().int().positive().max(2592000),
  max_views: z.number().int().min(1).max(100).default(1),
  burn_on_fail: z.boolean().default(true),
});

/**
 * Simple key-value store for aggregate counters. Currently tracks total drops
 * created (persists even after drops are consumed/expired). Not security-sensitive.
 */
export const stats = pgTable("stats", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: integer("value").notNull().default(0),
});

/**
 * Admin configuration — stores the hashed admin password and TOTP secret
 * for two-factor authentication. Only one row exists (key = "admin").
 * The TOTP secret is used to generate time-based one-time passwords via
 * an authenticator app (Google Authenticator, Authy, etc.).
 */
export const adminConfig = pgTable("admin_config", {
  key: varchar("key", { length: 64 }).primaryKey(),
  passwordHash: text("password_hash"),
  totpSecret: text("totp_secret"),
});

/**
 * Blog posts — stored as markdown with metadata for SEO and social sharing.
 * Each post gets a unique slug for clean URLs (/blog/:slug) and its own
 * OG meta tags for rich link previews when shared on Slack, Twitter, etc.
 */
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  title: varchar("title", { length: 512 }).notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  ogImageUrl: text("og_image_url"),
  published: integer("published").notNull().default(0),
  tags: text("tags").array(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const createBlogPostSchema = z.object({
  title: z.string().min(1).max(512),
  slug: z.string().min(1).max(256).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase with hyphens only"),
  excerpt: z.string().min(1),
  body: z.string().min(1),
  ogImageUrl: z.string().optional(),
  published: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

export type Drop = typeof drops.$inferSelect;
export type InsertDrop = typeof drops.$inferInsert;
export type CreateDropRequest = z.infer<typeof createDropSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;
export type CreateBlogPostRequest = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostRequest = z.infer<typeof updateBlogPostSchema>;
