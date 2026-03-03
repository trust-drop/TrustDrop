/**
 * Admin dashboard — password + TOTP two-factor authentication with blog post management
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, LogOut, Lock, KeyRound, Copy, Check, Upload, X, ImageIcon, ImagePlus, Loader2 } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";

/** First-time admin setup flow. Requires ADMIN_SETUP_TOKEN from the server environment to prevent unauthorized admin creation. Creates password (bcrypt, 12 rounds) and TOTP secret (compatible with Google Authenticator, Authy). */
function AdminSetup({ onComplete }: { onComplete: () => void }) {
  const [setupToken, setSetupToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const setupMutation = useMutation({
    mutationFn: async (data: { setupToken: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin/setup", data);
      return res.json();
    },
    onSuccess: (data) => {
      setQrCodeUrl(data.qrCodeDataUrl);
      setTotpSecret(data.totpSecret);
    },
    onError: (error: Error) => {
      toast({ title: "Setup failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSetup = () => {
    if (!setupToken) {
      toast({ title: "Setup token required", description: "Enter the setup token from the server environment", variant: "destructive" });
      return;
    }
    if (password.length < 12) {
      toast({ title: "Password too short", description: "Minimum 12 characters required", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please re-enter your password", variant: "destructive" });
      return;
    }
    setupMutation.mutate({ setupToken, password });
  };

  const handleCopySecret = async () => {
    if (totpSecret) {
      await navigator.clipboard.writeText(totpSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (qrCodeUrl) {
    return (
      <div className="flex flex-col items-center gap-6">
        <Shield className="w-12 h-12 text-primary" />
        <h2 className="text-xl font-semibold text-foreground" data-testid="text-totp-setup-title">
          Scan QR Code
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code to add TrustDrop.
        </p>
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <img src={qrCodeUrl} alt="TOTP QR Code" className="w-48 h-48" data-testid="img-totp-qr" />
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded" data-testid="text-totp-secret">
                {totpSecret}
              </code>
              <Button size="icon" variant="ghost" onClick={handleCopySecret} data-testid="button-copy-totp">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Save this secret key somewhere safe. You will need it if you lose access to your authenticator app.
        </p>
        <Button onClick={onComplete} data-testid="button-setup-done">
          I've Saved My Secret Key
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Shield className="w-12 h-12 text-primary" />
      <h2 className="text-xl font-semibold text-foreground" data-testid="text-setup-title">
        Admin Setup
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Create your admin password. You'll also set up two-factor authentication with an authenticator app.
      </p>
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setupToken">Setup Token</Label>
          <Input
            id="setupToken"
            type="password"
            value={setupToken}
            onChange={(e) => setSetupToken(e.target.value)}
            placeholder="Enter setup token from server"
            data-testid="input-setup-token"
          />
          <p className="text-xs text-muted-foreground">
            This is the ADMIN_SETUP_TOKEN value set in your server environment.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password (min. 12 characters)</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            data-testid="input-setup-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            data-testid="input-setup-confirm-password"
          />
        </div>
        <Button
          className="w-full"
          onClick={handleSetup}
          disabled={setupMutation.isPending}
          data-testid="button-create-admin"
        >
          {setupMutation.isPending ? "Setting up..." : "Create Admin Account"}
        </Button>
      </div>
    </div>
  );
}

/** Admin login with password + 6-digit TOTP code. Creates a session cookie on success (24-hour expiry, httpOnly, sameSite strict). */
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { password: string; totpCode: string }) => {
      const res = await apiRequest("POST", "/api/admin/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ password, totpCode });
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <Lock className="w-12 h-12 text-primary" />
      <h2 className="text-xl font-semibold text-foreground" data-testid="text-login-title">
        Admin Login
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Enter your admin password and authenticator code to continue.
      </p>
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="loginPassword">Password</Label>
          <Input
            id="loginPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            data-testid="input-login-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totpCode">Authenticator Code</Label>
          <Input
            id="totpCode"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            data-testid="input-login-totp"
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loginMutation.isPending}
          data-testid="button-login"
        >
          {loginMutation.isPending ? "Logging in..." : "Login"}
        </Button>
      </form>
    </div>
  );
}

/** Root admin component — routes between setup, login, and dashboard based on server state */
export default function Admin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const statusQuery = useQuery<{ isSetup: boolean }>({
    queryKey: ["/api/admin/status"],
  });

  const sessionQuery = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/session"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
    },
  });

  const isSetup = statusQuery.data?.isSetup;
  const isAdmin = sessionQuery.data?.isAdmin;

  if (statusQuery.isLoading || sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground" data-testid="text-admin-title">TrustDrop Admin</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </nav>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <AdminDashboard />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {!isSetup ? (
          <AdminSetup onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/status"] });
          }} />
        ) : (
          <AdminLogin onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
          }} />
        )}
      </div>
    </div>
  );
}

/** Blog post management dashboard. Lists all posts (including drafts) with edit/delete actions. */
function AdminDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const postsQuery = useQuery<any[]>({
    queryKey: ["/api/admin/blog"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/blog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      toast({ title: "Post deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  if (isCreating || editingPost) {
    return (
      <BlogPostEditor
        post={editingPost}
        onSave={() => {
          setIsCreating(false);
          setEditingPost(null);
          queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
        }}
        onCancel={() => {
          setIsCreating(false);
          setEditingPost(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-foreground" data-testid="text-dashboard-title">Blog Posts</h2>
        <Button onClick={() => setIsCreating(true)} data-testid="button-new-post">
          New Post
        </Button>
      </div>
      {postsQuery.isLoading ? (
        <div className="animate-pulse text-muted-foreground">Loading posts...</div>
      ) : postsQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No blog posts yet. Create your first post to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {postsQuery.data?.map((post: any) => (
            <Card key={post.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate" data-testid={`text-post-title-${post.id}`}>
                      {post.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        post.published === 1
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`badge-post-status-${post.id}`}
                    >
                      {post.published === 1 ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">/blog/{post.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPost(post)}
                    data-testid={`button-edit-post-${post.id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this post?")) {
                        deleteMutation.mutate(post.id);
                      }
                    }}
                    className="text-destructive"
                    data-testid={`button-delete-post-${post.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Blog post editor with title, slug (auto-generated from title for new posts), excerpt, markdown body, OG image upload, tags, and publish toggle. */
function BlogPostEditor({
  post,
  onSave,
  onCancel,
}: {
  post: any | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [body, setBody] = useState(post?.body || "");
  const [ogImageUrl, setOgImageUrl] = useState(post?.ogImageUrl || "");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const [published, setPublished] = useState(post?.published === 1);
  const [tags, setTags] = useState(post?.tags?.join(", ") || "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { uploadFile } = useUpload({
    onSuccess: (response) => {
      setOgImageUrl(response.objectPath);
      setIsUploadingImage(false);
      toast({ title: "Image uploaded" });
    },
    onError: (error) => {
      setIsUploadingImage(false);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });
  const { uploadFile: uploadInlineImage } = useUpload();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "OG images should be under 5 MB", variant: "destructive" });
      return;
    }

    setIsUploadingImage(true);
    await uploadFile(file);
  };

  /** Uploads an image to object storage and inserts markdown image syntax at the cursor position in the body editor */
  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Images must be under 5 MB", variant: "destructive" });
      return;
    }

    setIsUploadingInline(true);
    const result = await uploadInlineImage(file);
    setIsUploadingInline(false);

    if (result) {
      const altText = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const markdown = `![${altText}](${result.objectPath})`;
      const textarea = bodyRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = body.slice(0, start);
        const after = body.slice(end);
        const newBody = before + (before.length > 0 && !before.endsWith("\n") ? "\n" : "") + markdown + "\n" + after;
        setBody(newBody);
        requestAnimationFrame(() => {
          const cursorPos = before.length + (before.length > 0 && !before.endsWith("\n") ? 1 : 0) + markdown.length + 1;
          textarea.focus();
          textarea.setSelectionRange(cursorPos, cursorPos);
        });
      } else {
        setBody((prev: string) => prev + (prev.length > 0 ? "\n" : "") + markdown + "\n");
      }
      toast({ title: "Image inserted" });
    } else {
      toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
    }

    if (inlineFileRef.current) {
      inlineFileRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (post) {
        await apiRequest("PATCH", `/api/admin/blog/${post.id}`, data);
      } else {
        await apiRequest("POST", "/api/admin/blog", data);
      }
    },
    onSuccess: () => {
      toast({ title: post ? "Post updated" : "Post created" });
      onSave();
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  /** Auto-generates URL slug from title for new posts (lowercase, hyphens only) */
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!post) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const handleSave = () => {
    const parsedTags = tags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    saveMutation.mutate({
      title,
      slug,
      excerpt,
      body,
      ogImageUrl: ogImageUrl || undefined,
      published,
      tags: parsedTags,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-foreground" data-testid="text-editor-title">
          {post ? "Edit Post" : "New Post"}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-post">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="postTitle">Title</Label>
          <Input
            id="postTitle"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Post title"
            data-testid="input-post-title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postSlug">Slug</Label>
          <Input
            id="postSlug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="post-url-slug"
            data-testid="input-post-slug"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postExcerpt">Excerpt</Label>
          <textarea
            id="postExcerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Brief description for previews and SEO"
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="input-post-excerpt"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="postBody">Body (Markdown)</Label>
            <div className="flex items-center gap-2">
              <label
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs font-medium cursor-pointer hover:bg-muted/50 transition-colors text-muted-foreground"
                data-testid="button-insert-image"
              >
                {isUploadingInline ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                {isUploadingInline ? "Uploading..." : "Insert Image"}
                <input
                  ref={inlineFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleInlineImageUpload}
                  disabled={isUploadingInline}
                  className="hidden"
                  data-testid="input-inline-image-file"
                />
              </label>
            </div>
          </div>
          <textarea
            ref={bodyRef}
            id="postBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your post content in Markdown..."
            rows={16}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
            data-testid="input-post-body"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postTags">Tags (comma separated)</Label>
          <Input
            id="postTags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="security, privacy, encryption"
            data-testid="input-post-tags"
          />
        </div>

        <div className="space-y-2">
          <Label>OG Image (optional, recommended 1200x630px)</Label>
          {ogImageUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
              <ImageIcon className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground truncate flex-1" data-testid="text-og-image-path">
                {ogImageUrl.startsWith("/objects/") ? ogImageUrl.split("/").pop() : ogImageUrl}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOgImageUrl("")}
                data-testid="button-remove-og-image"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid="button-upload-og-image"
              >
                <Upload className="w-4 h-4" />
                {isUploadingImage ? "Uploading..." : "Upload Image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  disabled={isUploadingImage}
                  className="hidden"
                  data-testid="input-og-image-file"
                />
              </label>
              <span className="text-xs text-muted-foreground">PNG, JPG, or WebP - max 5 MB</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="postPublished"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="rounded border-border"
            data-testid="input-post-published"
          />
          <Label htmlFor="postPublished">Published</Label>
        </div>
      </div>
    </div>
  );
}
