/**
 * Database storage layer for TrustDrop.
 * All security-sensitive operations use PostgreSQL transactions with SELECT FOR UPDATE
 * to prevent race conditions (e.g., double-consuming a drop, concurrent view counting).
 */
import { drops, stats, adminConfig, blogPosts, type Drop, type DropMeta, type BlogPost } from "@shared/schema";
import { eq, lt, and, sql, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { randomBytes } from "crypto";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

/**
 * Generates a 128-bit cryptographically random drop ID (22 char base64url).
 * IDs and access tokens are separate values to implement defense-in-depth —
 * compromising one doesn't expose the other.
 */
function generateSecureId(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Generates a 128-bit cryptographically random access token (22 char base64url).
 * Required for all drop operations — acts as a second authentication factor
 * independent of the drop ID.
 */
function generateAccessToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Abstraction for storage operations. All methods that accept an accessToken
 * validate it and return null on mismatch — this uniform response prevents
 * existence leakage (callers cannot distinguish "not found" from "wrong token").
 */
export interface IStorage {
  createDrop(
    ciphertextB64: string,
    meta: DropMeta,
    expiresInSeconds: number,
    maxViews: number,
    burnOnFail: boolean
  ): Promise<{ id: string; accessToken: string }>;
  getDropMeta(id: string, accessToken: string): Promise<{ meta: DropMeta; maxViews: number; viewCount: number } | null>;
  fetchDrop(id: string, accessToken: string): Promise<{ ciphertext_b64: string; meta: DropMeta; maxViews: number; viewCount: number } | null>;
  confirmView(id: string, accessToken: string): Promise<{ remainingViews: number } | null>;
  burnDrop(id: string, accessToken: string): Promise<boolean>;
  cleanupExpired(): Promise<number>;
  incrementDropCount(): Promise<void>;
  getTotalDrops(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  /**
   * Creates a new encrypted drop. Generates both a secure ID and access token.
   * Only these two values are returned to the client; the server never sees the
   * encryption key (it exists only in the URL fragment on the client side).
   */
  async createDrop(
    ciphertextB64: string,
    meta: DropMeta,
    expiresInSeconds: number,
    maxViews: number,
    burnOnFail: boolean
  ): Promise<{ id: string; accessToken: string }> {
    const id = generateSecureId();
    const accessToken = generateAccessToken();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await db.insert(drops).values({
      id,
      accessToken,
      ciphertextB64,
      meta,
      expiresAt,
      maxViews,
      viewCount: 0,
      burnOnFail: burnOnFail ? 1 : 0,
    });

    await this.incrementDropCount();

    return { id, accessToken };
  }

  /**
   * Returns drop metadata without ciphertext. Validates access token —
   * returns null for invalid token, expired drop, or non-existent drop
   * (uniform 404 pattern prevents existence leakage).
   * Also cleans up expired drops on access.
   */
  async getDropMeta(id: string, accessToken: string): Promise<{ meta: DropMeta; maxViews: number; viewCount: number } | null> {
    const results = await db
      .select({ meta: drops.meta, expiresAt: drops.expiresAt, maxViews: drops.maxViews, viewCount: drops.viewCount, accessToken: drops.accessToken })
      .from(drops)
      .where(eq(drops.id, id))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];

    // Uniform null return for invalid token (same as not-found)
    if (row.accessToken !== accessToken) return null;

    // Eagerly delete expired drops on access attempt
    if (new Date(row.expiresAt) < new Date()) {
      await db.delete(drops).where(eq(drops.id, id));
      return null;
    }

    return { meta: row.meta, maxViews: row.maxViews, viewCount: row.viewCount };
  }

  /**
   * Part 1 of the two-step consume flow. Uses SELECT FOR UPDATE to lock the row
   * during the transaction. Returns ciphertext WITHOUT incrementing view count.
   * This ensures network failures or wrong passwords don't waste views.
   * The client decrypts locally, then calls confirmView only on success.
   */
  async fetchDrop(
    id: string,
    accessToken: string
  ): Promise<{ ciphertext_b64: string; meta: DropMeta; maxViews: number; viewCount: number } | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // SELECT FOR UPDATE locks the row to prevent concurrent access
      const selectResult = await client.query(
        'SELECT ciphertext_b64, meta, expires_at, max_views, view_count, access_token FROM drops WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (selectResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const row = selectResult.rows[0];

      // Uniform null return — same response for wrong token as not-found
      if (row.access_token !== accessToken) {
        await client.query("ROLLBACK");
        return null;
      }

      // Clean up expired drops on access
      if (new Date(row.expires_at) < new Date()) {
        await client.query("DELETE FROM drops WHERE id = $1", [id]);
        await client.query("COMMIT");
        return null;
      }

      await client.query("COMMIT");

      return {
        ciphertext_b64: row.ciphertext_b64,
        meta: row.meta as DropMeta,
        maxViews: row.max_views,
        viewCount: row.view_count,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Part 2 of the two-step consume flow. Called only after the client
   * successfully decrypts. Uses SELECT FOR UPDATE for atomic view counting.
   * If maxViews reached, permanently deletes the drop — it cannot be recovered.
   */
  async confirmView(id: string, accessToken: string): Promise<{ remainingViews: number } | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lock row for atomic view count increment
      const selectResult = await client.query(
        'SELECT max_views, view_count, access_token FROM drops WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (selectResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const row = selectResult.rows[0];

      if (row.access_token !== accessToken) {
        await client.query("ROLLBACK");
        return null;
      }

      const newViewCount = row.view_count + 1;
      const remainingViews = row.max_views - newViewCount;

      if (remainingViews <= 0) {
        // Max views reached — permanently delete the drop
        await client.query("DELETE FROM drops WHERE id = $1", [id]);
      } else {
        await client.query("UPDATE drops SET view_count = $1 WHERE id = $2", [newViewCount, id]);
      }

      await client.query("COMMIT");

      return { remainingViews: Math.max(0, remainingViews) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Anti-brute-force kill switch. Called when client-side decryption fails
   * (wrong password). If burn_on_fail is enabled, permanently deletes the
   * drop — there's no recovery. One wrong attempt = total destruction.
   */
  async burnDrop(id: string, accessToken: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const selectResult = await client.query(
        'SELECT burn_on_fail, access_token FROM drops WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (selectResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }

      const row = selectResult.rows[0];

      if (row.access_token !== accessToken) {
        await client.query("ROLLBACK");
        return false;
      }

      if (row.burn_on_fail === 1) {
        // Permanently destroy the drop — no recovery possible
        await client.query("DELETE FROM drops WHERE id = $1", [id]);
        await client.query("COMMIT");
        return true;
      }

      await client.query("COMMIT");
      return false;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Background job target. Removes drops past their expiry time. Runs every 60 seconds. */
  async cleanupExpired(): Promise<number> {
    const result = await db
      .delete(drops)
      .where(lt(drops.expiresAt, new Date()));
    return result.rowCount ?? 0;
  }

  /**
   * Atomic upsert counter for aggregate statistics. Uses INSERT ON CONFLICT UPDATE
   * to safely increment without race conditions.
   */
  async incrementDropCount(): Promise<void> {
    await db
      .insert(stats)
      .values({ key: "total_drops", value: 1 })
      .onConflictDoUpdate({
        target: stats.key,
        set: { value: sql`${stats.value} + 1` },
      });
  }

  /** Returns total drops ever created (persists even after drops are consumed/expired). */
  async getTotalDrops(): Promise<number> {
    const results = await db
      .select({ value: stats.value })
      .from(stats)
      .where(eq(stats.key, "total_drops"))
      .limit(1);

    return results.length > 0 ? results[0].value : 0;
  }

  // --- Admin Config ---

  /** Returns admin config (password hash + TOTP secret) or null if not yet set up. */
  async getAdminConfig(): Promise<{ passwordHash: string | null; totpSecret: string | null } | null> {
    const results = await db
      .select()
      .from(adminConfig)
      .where(eq(adminConfig.key, "admin"))
      .limit(1);
    if (results.length === 0) return null;
    return { passwordHash: results[0].passwordHash, totpSecret: results[0].totpSecret };
  }

  /** Creates or updates admin config with hashed password and TOTP secret. */
  async setAdminConfig(passwordHash: string, totpSecret: string): Promise<void> {
    await db
      .insert(adminConfig)
      .values({ key: "admin", passwordHash, totpSecret })
      .onConflictDoUpdate({
        target: adminConfig.key,
        set: { passwordHash, totpSecret },
      });
  }

  // --- Blog Posts ---

  /** Returns all blog posts ordered by creation date (newest first). */
  async listBlogPosts(publishedOnly: boolean = false): Promise<BlogPost[]> {
    if (publishedOnly) {
      return db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.published, 1))
        .orderBy(desc(blogPosts.publishedAt));
    }
    return db
      .select()
      .from(blogPosts)
      .orderBy(desc(blogPosts.createdAt));
  }

  /** Returns a single blog post by slug. */
  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const results = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    return results.length > 0 ? results[0] : null;
  }

  /** Returns a single blog post by ID. */
  async getBlogPostById(id: string): Promise<BlogPost | null> {
    const results = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, id))
      .limit(1);
    return results.length > 0 ? results[0] : null;
  }

  /** Creates a new blog post. Returns the created post. */
  async createBlogPost(post: {
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    ogImageUrl?: string;
    published: boolean;
    tags?: string[];
  }): Promise<BlogPost> {
    const id = randomBytes(16).toString("base64url");
    const now = new Date();
    const values = {
      id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      ogImageUrl: post.ogImageUrl || null,
      published: post.published ? 1 : 0,
      tags: post.tags || [],
      publishedAt: post.published ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(blogPosts).values(values);
    return { ...values } as BlogPost;
  }

  /** Updates an existing blog post by ID. */
  async updateBlogPost(id: string, updates: {
    title?: string;
    slug?: string;
    excerpt?: string;
    body?: string;
    ogImageUrl?: string;
    published?: boolean;
    tags?: string[];
  }): Promise<BlogPost | null> {
    const existing = await this.getBlogPostById(id);
    if (!existing) return null;

    const setValues: any = { updatedAt: new Date() };
    if (updates.title !== undefined) setValues.title = updates.title;
    if (updates.slug !== undefined) setValues.slug = updates.slug;
    if (updates.excerpt !== undefined) setValues.excerpt = updates.excerpt;
    if (updates.body !== undefined) setValues.body = updates.body;
    if (updates.ogImageUrl !== undefined) setValues.ogImageUrl = updates.ogImageUrl;
    if (updates.tags !== undefined) setValues.tags = updates.tags;
    if (updates.published !== undefined) {
      setValues.published = updates.published ? 1 : 0;
      // Set publishedAt when first published
      if (updates.published && !existing.publishedAt) {
        setValues.publishedAt = new Date();
      }
    }

    await db.update(blogPosts).set(setValues).where(eq(blogPosts.id, id));
    return this.getBlogPostById(id);
  }

  /** Permanently deletes a blog post by ID. */
  async deleteBlogPost(id: string): Promise<boolean> {
    const result = await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
