/**
 * Create page — the main drop creation interface. Handles text messages and file uploads with client-side AES-256-GCM encryption.
 */
import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Copy, Upload, AlertTriangle, Check, FileText, X, Flame, Eye, Clock, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { encryptMessage, encryptFile } from "@/lib/crypto";
import { Layout, DropIcon } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";

type PageState = "create" | "creating" | "created";

export default function Home() {
  const [pageState, setPageState] = useState<PageState>("create");
  const [createdUrl, setCreatedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [activeTab, setActiveTab] = useState("message");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [expiresIn, setExpiresIn] = useState("86400");
  const [maxViews, setMaxViews] = useState("1");
  const [burnOnFail, setBurnOnFail] = useState(true);

  const { toast } = useToast();

  const handleCreate = useCallback(async () => {
    // Phase 1: Validation — ensure content is provided
    if (activeTab === "message" && !message.trim()) {
      toast({
        title: "Please enter a message",
        variant: "destructive",
      });
      return;
    }
    if (activeTab === "file" && !file) {
      toast({
        title: "Please select a file",
        variant: "destructive",
      });
      return;
    }

    setPageState("creating");

    try {
      // Phase 2: Encryption — Mode A (link-only key) vs Mode B (password-derived key)
      let result;
      if (activeTab === "message") {
        result = await encryptMessage(message, password || undefined);
      } else {
        const fileData = await file!.arrayBuffer();
        result = await encryptFile(fileData, password || undefined);
      }

      const meta: Record<string, unknown> = {
        iv: result.iv,
        salt: result.salt,
        hasPassword: !!password,
        type: activeTab === "message" ? "text" : "file",
      };

      if (activeTab === "file" && file) {
        meta.mime = file.type || "application/octet-stream";
        meta.filename = file.name;
        meta.size = file.size;
      }

      // Phase 3: API submission — send ciphertext and metadata to the server
      const response = await apiRequest("POST", "/api/drops", {
        ciphertext_b64: result.ciphertext_b64,
        meta,
        expires_in_seconds: parseInt(expiresIn),
        max_views: parseInt(maxViews),
        burn_on_fail: burnOnFail,
      });

      const { id, accessToken } = await response.json();

      // URL format: /d/{id}?t={accessToken}#k={encryptionKey}. The access token (query param) is sent to the server for authorization. The encryption key (fragment) is NEVER sent to the server.
      let url = `${window.location.origin}/d/${id}?t=${accessToken}`;
      if (result.keyBase64url) {
        url += `#k=${result.keyBase64url}`;
      }

      setCreatedUrl(url);
      setPageState("created");
    } catch (error: any) {
      toast({
        title: "Failed to create drop",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setPageState("create");
    }
  }, [activeTab, message, file, password, expiresIn, maxViews, burnOnFail, toast]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }, [createdUrl, toast]);

  const handleCreateAnother = useCallback(() => {
    setPageState("create");
    setCreatedUrl("");
    setMessage("");
    setFile(null);
    setPassword("");
    setExpiresIn("86400");
    setMaxViews("1");
    setBurnOnFail(true);
    setCopied(false);
  }, []);

  const viewLabel = maxViews === "1" ? "1 view" : `${maxViews} views`;
  const expiryLabel =
    expiresIn === "3600"
      ? "1 hour"
      : expiresIn === "86400"
        ? "24 hours"
        : expiresIn === "604800"
          ? "7 days"
          : "30 days";

  if (pageState === "created") {
    return (
      <Layout>
        <PageMeta
          title="Secure One-Time Secret Sharing"
          description="Share passwords, API keys, and confidential files through self-destructing encrypted links. Client-side AES-256-GCM encryption — your secrets never touch our servers."
          canonicalPath="/"
        />
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">
          <DropIcon className="w-20 h-20 mb-6" />
          <h1
            className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3"
            data-testid="text-created-title"
          >
            Drop Created Successfully
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Share this link securely with your recipient
          </p>

          <div className="w-full rounded-2xl border border-border/50 p-6 bg-card/60">
            <label className="text-sm font-medium text-foreground mb-2 block">
              One-Time Link
            </label>
            <div className="flex gap-2 mb-4">
              <Input
                readOnly
                value={createdUrl}
                className="bg-background/60 border-border/50 text-muted-foreground font-mono text-sm"
                data-testid="input-drop-url"
              />
              <Button
                onClick={handleCopy}
                data-testid="button-copy-url"
              >
                {copied ? (
                  <Check className="w-4 h-4 mr-1.5" />
                ) : (
                  <Copy className="w-4 h-4 mr-1.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            {/* Displays active burn rules to the creator so they know how the drop will self-destruct */}
            <div className="rounded-md border border-warning/30 bg-warning/10 p-4 mb-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-semibold text-warning">Burn Rules:</span>{" "}
                  <span className="text-muted-foreground">
                    This drop will be destroyed after {viewLabel} or {expiryLabel}, whichever comes first.
                    {burnOnFail && password && " Wrong password attempts will also destroy it instantly."}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreateAnother}
              variant="secondary"
              className="w-full"
              data-testid="button-create-another"
            >
              Create Another Drop
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageMeta
        title="Secure One-Time Secret Sharing"
        description="Share passwords, API keys, and confidential files through self-destructing encrypted links. Client-side AES-256-GCM encryption — your secrets never touch our servers."
        canonicalPath="/"
      />
      <div className="flex flex-col items-center w-full max-w-lg mx-auto">
        <DropIcon className="w-20 h-20 mb-6" />
        <h1
          className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3"
          data-testid="text-hero-title"
        >
          Share Secrets Securely
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          One-time encrypted message sharing. Zero knowledge. Maximum privacy.
        </p>

        <div className="w-full rounded-2xl border border-border/50 p-6 bg-card/60">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-4">
              <TabsTrigger
                value="message"
                className="flex-1 gap-1.5"
                data-testid="tab-message"
              >
                <FileText className="w-4 h-4" />
                Message
              </TabsTrigger>
              <TabsTrigger
                value="file"
                className="flex-1 gap-1.5"
                data-testid="tab-file"
              >
                <Upload className="w-4 h-4" />
                File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="message">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Your Secret Message
              </label>
              <Textarea
                placeholder="Paste your confidential message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[140px] bg-background/60 border-border/50 resize-none mb-4"
                data-testid="textarea-message"
              />
            </TabsContent>

            <TabsContent value="file">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Upload File
              </label>
              <div
                className="border-2 border-dashed border-border/50 rounded-md p-8 text-center mb-4 cursor-pointer transition-colors hover:border-primary/40"
                onClick={() =>
                  document.getElementById("file-input")?.click()
                }
                data-testid="dropzone-file"
              >
                <input
                  type="file"
                  id="file-input"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  data-testid="input-file"
                />
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                {file ? (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-foreground font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      data-testid="button-remove-file"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground">
                      Click to select a file
                    </p>
                    <p className="text-muted-foreground/60 text-sm mt-1">
                      Up to 50 MB
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Burn rule configuration — time-based expiry, view limits, and wrong-password destruction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Password (Optional)
              </label>
              <Input
                type="password"
                placeholder="Optional protection"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/60 border-border/50"
                data-testid="input-password"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Expires In
              </label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger
                  className="bg-background/60 border-border/50"
                  data-testid="select-expiry"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">1 Hour</SelectItem>
                  <SelectItem value="86400">24 Hours</SelectItem>
                  <SelectItem value="604800">7 Days</SelectItem>
                  <SelectItem value="2592000">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                <Eye className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Max Views Before Burn
              </label>
              <Select value={maxViews} onValueChange={setMaxViews}>
                <SelectTrigger
                  className="bg-background/60 border-border/50"
                  data-testid="select-max-views"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 View (Default)</SelectItem>
                  <SelectItem value="3">3 Views</SelectItem>
                  <SelectItem value="5">5 Views</SelectItem>
                  <SelectItem value="10">10 Views</SelectItem>
                  <SelectItem value="25">25 Views</SelectItem>
                  <SelectItem value="50">50 Views</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                <ShieldAlert className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Wrong Password
              </label>
              <Select value={burnOnFail ? "burn" : "keep"} onValueChange={(v) => setBurnOnFail(v === "burn")}>
                <SelectTrigger
                  className="bg-background/60 border-border/50"
                  data-testid="select-burn-on-fail"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="burn">Burn Immediately</SelectItem>
                  <SelectItem value="keep">Allow Retry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={pageState === "creating"}
            className="w-full"
            size="lg"
            data-testid="button-create-drop"
          >
            {pageState === "creating" ? "Encrypting..." : "Create Secure Drop"}
          </Button>
        </div>

        <div className="w-full mt-6 rounded-2xl border border-border/30 p-4 bg-card/30 flex items-start gap-3">
          <Lock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Your message is encrypted end-to-end. Configure burn rules to control
            when the drop self-destructs — by time, views, or failed password attempts.
          </p>
        </div>
      </div>
    </Layout>
  );
}
