/**
 * Retrieve and decrypt page — handles the full lifecycle of opening a TrustDrop link
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, AlertTriangle, X, Home, Download, Loader2, Copy, Check, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { decryptMessage, decryptToBuffer } from "@/lib/crypto";
import { Layout, DropIcon } from "@/components/layout";
import type { DropMeta } from "@shared/schema";

type RetrieveState =
  | "loading"          // Initial state while checking if the drop exists
  | "password-needed"  // Drop requires a password (Mode B encryption)
  | "ready-to-reveal"  // Drop is ready to decrypt (Mode A — key in URL fragment)
  | "consuming"        // Currently fetching and decrypting the drop
  | "decrypted"        // Successfully decrypted — content is visible
  | "destroying"       // Destroy animation is playing
  | "destroyed"        // Content has been permanently cleared from the browser
  | "error"            // Drop not found, expired, or invalid link
  | "decrypt-error"    // Decryption failed (corrupted data or wrong key)
  | "burned";          // Wrong password triggered burn-on-fail — drop permanently destroyed

/** Animated particle burst effect for the destroy animation. Generates 32 particles with random trajectories and colors matching the brand palette. */
function DestroyParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 32 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 32 + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 160;
      const size = 3 + Math.random() * 6;
      const duration = 0.6 + Math.random() * 0.6;
      const delay = Math.random() * 0.15;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const colors = [
        "hsl(195, 55%, 42%)",
        "hsl(0, 84%, 52%)",
        "hsl(38, 92%, 50%)",
        "hsl(210, 20%, 60%)",
        "hsl(195, 55%, 62%)",
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return { tx, ty, size, duration, delay, color };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 10 }}>
      {particles.map((p, i) => (
        <div
          key={i}
          className="destroy-particle"
          style={{
            width: p.size,
            height: p.size,
            left: "50%",
            top: "50%",
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            "--px": `${p.tx}px`,
            "--py": `${p.ty}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function Retrieve() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [state, setState] = useState<RetrieveState>("loading");
  const [meta, setMeta] = useState<DropMeta | null>(null);
  const [decryptedText, setDecryptedText] = useState("");
  const [decryptedFile, setDecryptedFile] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  const [copied, setCopied] = useState(false);
  const [remainingViews, setRemainingViews] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const destroyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Extracts the AES-256-GCM key from the URL fragment (#k=...). The key never touches the server — it exists only in the fragment which browsers do not send in HTTP requests. */
  const getKeyFromHash = useCallback(() => {
    const hash = window.location.hash;
    const match = hash.match(/#k=(.+)/);
    return match ? match[1] : null;
  }, []);

  /** Extracts the access token from the query string (?t=...). This IS sent to the server for authorization. */
  const getAccessToken = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("t") || "";
  }, []);

  // On mount, checks if the drop exists via /meta endpoint. Determines whether to show password prompt (Mode B) or ready-to-reveal (Mode A with key in fragment).
  useEffect(() => {
    async function checkDrop() {
      try {
        const token = getAccessToken();
        if (!token) {
          setState("error");
          return;
        }

        const res = await fetch(`/api/drops/${id}/meta?t=${encodeURIComponent(token)}`);
        if (!res.ok) {
          setState("error");
          return;
        }
        const data = await res.json();
        setMeta(data.meta);

        const keyFromHash = getKeyFromHash();

        if (data.meta.hasPassword) {
          setState("password-needed");
        } else if (keyFromHash) {
          setState("ready-to-reveal");
        } else {
          setState("error");
        }
      } catch {
        setState("error");
      }
    }
    checkDrop();
  }, [id, getKeyFromHash, getAccessToken]);

  // Auto-destroy timer — clears decrypted content from the browser after 5 minutes as a safety net
  useEffect(() => {
    if (state === "decrypted") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleDestroy();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  /**
   * Two-step consume flow:
   * 1) Fetch ciphertext via /consume (no view counted),
   * 2) Decrypt locally,
   * 3) On success: /confirm increments view count,
   * 4) On failure: /burn destroys if burn_on_fail enabled
   */
  const handleConsume = useCallback(async () => {
    setState("consuming");

    try {
      const token = getAccessToken();
      const res = await fetch(`/api/drops/${id}/consume?t=${encodeURIComponent(token)}`, { method: "POST" });
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = await res.json();
      const { ciphertext_b64, meta: dropMeta } = data;

      const keyFromHash = getKeyFromHash();

      try {
        if (dropMeta.type === "file") {
          const decrypted = await decryptToBuffer(
            ciphertext_b64,
            dropMeta.iv,
            keyFromHash || undefined,
            password || undefined,
            dropMeta.salt || undefined
          );
          const blob = new Blob([decrypted], {
            type: dropMeta.mime || "application/octet-stream",
          });
          const url = URL.createObjectURL(blob);
          setDecryptedFile({ url, filename: dropMeta.filename || "download" });
        } else {
          const text = await decryptMessage(
            ciphertext_b64,
            dropMeta.iv,
            keyFromHash || undefined,
            password || undefined,
            dropMeta.salt || undefined
          );
          setDecryptedText(text);
        }

        const confirmRes = await fetch(`/api/drops/${id}/confirm?t=${encodeURIComponent(token)}`, { method: "POST" });
        const confirmData = await confirmRes.json();
        setRemainingViews(confirmData.remainingViews ?? 0);

        setMeta(dropMeta);
        setState("decrypted");
      } catch (decryptErr: any) {
        try {
          await fetch(`/api/drops/${id}/burn?t=${encodeURIComponent(token)}`, { method: "POST" });
        } catch {}

        if (
          decryptErr.message?.includes("decrypt") ||
          decryptErr.name === "OperationError"
        ) {
          setState("burned");
        } else {
          setState("decrypt-error");
        }
      }
    } catch (error: any) {
      setState("error");
    }
  }, [id, password, getKeyFromHash, getAccessToken]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (destroyTimeoutRef.current) clearTimeout(destroyTimeoutRef.current);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  /** Triggers the destroy animation sequence: flash -> particle burst -> card shrink -> show destroyed state. Also revokes any object URLs for file downloads. */
  const handleDestroy = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState("destroying");

    destroyTimeoutRef.current = setTimeout(() => {
      setDecryptedText("");
      if (decryptedFile) {
        URL.revokeObjectURL(decryptedFile.url);
        setDecryptedFile(null);
      }
      setState("destroyed");
      destroyTimeoutRef.current = null;
    }, 1200);
  }, [decryptedFile]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (state === "loading" || state === "consuming") {
    return (
      <Layout>
        <div className="flex flex-col items-center w-full max-w-lg mx-auto pt-8">
          <DropIcon className="w-20 h-20 mb-6 animate-pulse" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-lg">
              {state === "loading" ? "Loading drop..." : "Decrypting..."}
            </span>
          </div>
        </div>
      </Layout>
    );
  }

  if (state === "error") {
    return (
      <Layout>
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">
          <DropIcon className="w-20 h-20 mb-6 opacity-50" />
          <h1
            className="text-3xl font-bold text-foreground text-center mb-3"
            data-testid="text-error-title"
          >
            Drop Not Found
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            This drop has already been viewed, has expired, or the link is
            invalid.
          </p>
          <Button
            onClick={() => navigate("/")}
            variant="secondary"
            data-testid="button-go-home"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </div>
      </Layout>
    );
  }

  if (state === "burned") {
    return (
      <Layout>
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">
          <DropIcon className="w-20 h-20 mb-6 opacity-50" />
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-7 h-7 text-destructive" />
            <h1
              className="text-3xl font-bold text-foreground text-center"
              data-testid="text-burned-title"
            >
              Drop Burned
            </h1>
          </div>
          <p className="text-muted-foreground text-center mb-8 max-w-sm">
            The password was incorrect. As a security measure, this drop has been
            permanently destroyed to prevent brute-force attacks.
          </p>
          <Button
            onClick={() => navigate("/")}
            variant="secondary"
            data-testid="button-go-home-burned"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </div>
      </Layout>
    );
  }

  if (state === "decrypt-error") {
    return (
      <Layout>
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">
          <DropIcon className="w-20 h-20 mb-6 opacity-50" />
          <h1
            className="text-3xl font-bold text-foreground text-center mb-3"
            data-testid="text-decrypt-error-title"
          >
            Decryption Failed
          </h1>
          <p className="text-muted-foreground text-center mb-8 max-w-sm">
            The password was incorrect or the data was corrupted. The drop has
            been permanently destroyed.
          </p>
          <Button
            onClick={() => navigate("/")}
            variant="secondary"
            data-testid="button-go-home-error"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </div>
      </Layout>
    );
  }

  if (state === "destroying") {
    return (
      <Layout>
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">
          <DropIcon className="w-20 h-20 mb-6" />
          <h1
            className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3"
            data-testid="text-destroying-title"
          >
            Destroying...
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Permanently erasing all traces
          </p>

          <div className="w-full relative" style={{ overflow: "visible" }}>
            <div className="destroy-flash-overlay absolute inset-0 rounded-2xl bg-destructive pointer-events-none" style={{ zIndex: 5 }} />
            <DestroyParticles />
            <div className="destroy-card-animate w-full rounded-2xl border border-border/50 p-6 bg-card/60">
              <div className="rounded-md border border-border/50 p-6 bg-background/60 mb-4">
                <div className="space-y-2">
                  <div className="h-3 bg-muted-foreground/20 rounded w-full" />
                  <div className="h-3 bg-muted-foreground/20 rounded w-4/5" />
                  <div className="h-3 bg-muted-foreground/20 rounded w-3/5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 bg-destructive/30 rounded-md" />
                <div className="h-10 bg-secondary/30 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (state === "destroyed") {
    return (
      <Layout>
        <div className="flex flex-col items-center w-full max-w-lg mx-auto destroy-result-fade">
          <DropIcon className="w-20 h-20 mb-6" />
          <h1
            className="text-3xl font-bold text-foreground text-center mb-3"
            data-testid="text-destroyed-title"
          >
            Drop Destroyed
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            The message has been permanently deleted and cleared from your
            browser.
          </p>
          <Button
            onClick={() => navigate("/")}
            variant="secondary"
            data-testid="button-go-home-destroyed"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </div>
      </Layout>
    );
  }

  if (state === "decrypted") {
    return (
      <Layout>
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">
          <DropIcon className="w-20 h-20 mb-6" />
          <h1
            className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3"
            data-testid="text-decrypted-title"
          >
            Message Decrypted
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Read carefully - this message will self-destruct
          </p>

          <div className="w-full rounded-2xl border border-border/50 p-6 bg-card/60">
            {meta?.type === "file" && decryptedFile ? (
              <div className="rounded-md border border-border/50 p-6 bg-background/60 mb-4 flex flex-col items-center gap-3">
                <p className="text-foreground">
                  File:{" "}
                  <span className="font-mono text-sm">
                    {decryptedFile.filename}
                  </span>
                </p>
                <Button asChild data-testid="button-download-file">
                  <a href={decryptedFile.url} download={decryptedFile.filename}>
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </a>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-border/50 p-6 bg-background/60 mb-4 relative group">
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 opacity-60 hover:opacity-100 transition-opacity"
                  onClick={() => {
                    navigator.clipboard.writeText(decryptedText);
                    setCopied(true);
                    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
                    copiedTimeoutRef.current = setTimeout(() => {
                      setCopied(false);
                      copiedTimeoutRef.current = null;
                    }, 2000);
                  }}
                  data-testid="button-copy-message"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <p
                  className="text-foreground whitespace-pre-wrap break-words leading-relaxed pr-8"
                  data-testid="text-decrypted-message"
                >
                  {decryptedText}
                </p>
              </div>
            )}

            <div className="rounded-md border border-warning/30 bg-warning/10 p-4 mb-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm">
                  <span className="font-semibold text-warning">Warning:</span>{" "}
                  <span className="text-muted-foreground">
                    {remainingViews > 0
                      ? `This drop has ${remainingViews} view${remainingViews !== 1 ? "s" : ""} remaining. `
                      : "This was the last view. The drop has been destroyed on the server. "}
                    Content will clear from your browser in {formatTime(timeLeft)}.
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleDestroy}
                variant="destructive"
                data-testid="button-destroy"
              >
                <X className="w-4 h-4 mr-2" />
                Destroy Now
              </Button>
              <Button
                onClick={() => {
                  setDecryptedText("");
                  if (decryptedFile) {
                    URL.revokeObjectURL(decryptedFile.url);
                    setDecryptedFile(null);
                  }
                  if (timerRef.current) clearInterval(timerRef.current);
                  if (destroyTimeoutRef.current) clearTimeout(destroyTimeoutRef.current);
                  navigate("/");
                }}
                variant="secondary"
                data-testid="button-return-home"
              >
                Return Home
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col items-center w-full max-w-lg mx-auto">
        <DropIcon className="w-20 h-20 mb-6" />
        <h1
          className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3"
          data-testid="text-retrieve-title"
        >
          Retrieve Your Drop
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          {state === "password-needed"
            ? "Enter the password to decrypt this message"
            : "Decrypt using the secure link"}
        </p>

        <div className="w-full rounded-2xl border border-border/50 p-6 bg-card/60">
          <div className="rounded-md border border-border/50 p-6 bg-background/30 mb-6 flex flex-col items-center gap-4">
            <div className="flex flex-wrap gap-2 justify-center max-w-[280px]">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-muted-foreground/30"
                />
              ))}
            </div>
            <Lock className="w-6 h-6 text-muted-foreground/50" />
          </div>

          {state === "password-needed" && (
            <>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Enter Password
              </label>
              <Input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/60 border-border/50 mb-4"
                onKeyDown={(e) => e.key === "Enter" && handleConsume()}
                data-testid="input-decrypt-password"
              />
            </>
          )}

          <Button
            onClick={handleConsume}
            disabled={state === "password-needed" && !password}
            className="w-full"
            size="lg"
            data-testid="button-decrypt"
          >
            {state === "password-needed" ? "Decrypt Message" : "Reveal Message"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
