import { Layout } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Lock, Unlock, Database, Shield, Eye, Clock, KeyRound, Flame, ArrowRight } from "lucide-react";

function StepCard({ step, title, icon: Icon, items, zone }: {
  step: number;
  title: string;
  icon: typeof Lock;
  items: string[];
  zone: "trusted" | "untrusted";
}) {
  const borderColor = zone === "trusted" ? "border-emerald-500/40" : "border-red-500/40";
  const iconBg = zone === "trusted" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400";
  const stepColor = zone === "trusted" ? "text-emerald-400" : "text-red-400";

  return (
    <Card className={`p-5 ${borderColor}`} data-testid={`card-step-${step}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${stepColor}`}>Step {step}</span>
          <h3 className="text-base font-semibold text-foreground leading-tight">{title}</h3>
        </div>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FeatureCard({ icon: Icon, title, description }: {
  icon: typeof Lock;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-5" data-testid={`card-feature-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted text-foreground">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </Card>
  );
}

export default function HowItWorks() {
  return (
    <Layout>
      <PageMeta
        title="How It Works — Zero-Knowledge Encryption"
        description="Learn how TrustDrop encrypts secrets in your browser before anything leaves your device. AES-256-GCM, one-time links, and automatic destruction after viewing."
        canonicalPath="/how-it-works"
      />
      <div className="w-full max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3" data-testid="text-how-it-works-title">
          How TrustDrop Works
        </h1>
        <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
          TrustDrop uses a zero-knowledge architecture so the server can never read your secrets. Here's exactly how it works.
        </p>

        <div className="max-w-4xl mx-auto space-y-12">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-flow">The Three-Step Flow</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Every secret follows the same path: encrypt in the sender's browser, store blindly on the server, decrypt in the recipient's browser.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <StepCard
                step={1}
                title="Sender's Browser"
                icon={Lock}
                zone="trusted"
                items={[
                  "Generate a random 256-bit encryption key (or derive one from your password via PBKDF2)",
                  "Encrypt with AES-256-GCM before anything touches the network",
                  "Configure burn rules: expiry time, max views, wrong-password protection",
                ]}
              />
              <StepCard
                step={2}
                title="Server (Blind Storage)"
                icon={Database}
                zone="untrusted"
                items={[
                  "Receives only encrypted ciphertext \u2014 cannot decrypt it",
                  "Generates a 128-bit Drop ID and a separate 128-bit Access Token",
                  "Stores ciphertext with metadata (expiry, view count, burn rules)",
                ]}
              />
              <StepCard
                step={3}
                title="Recipient's Browser"
                icon={Unlock}
                zone="trusted"
                items={[
                  "Extracts the encryption key from the URL fragment (never sent to the server)",
                  "Two-step consume: fetch ciphertext, decrypt locally, then confirm success",
                  "Drop is destroyed after rules are met (views exhausted, time expired, or wrong password)",
                ]}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-url">Three-Part URL Security</h2>
            <p className="text-sm text-muted-foreground mb-5">
              The share link is split into three independent security layers. Each part serves a different purpose, and compromising one doesn't compromise the others.
            </p>
            <Card className="p-5" data-testid="card-url-security">
              <div className="font-mono text-sm text-muted-foreground mb-4 overflow-x-auto whitespace-nowrap pb-2" data-testid="text-url-format">
                <span className="text-foreground">/d/</span>
                <span className="text-emerald-400">{"{"}</span>
                <span className="text-emerald-400">id</span>
                <span className="text-emerald-400">{"}"}</span>
                <span className="text-foreground">?t=</span>
                <span className="text-amber-400">{"{"}</span>
                <span className="text-amber-400">accessToken</span>
                <span className="text-amber-400">{"}"}</span>
                <span className="text-foreground">#k=</span>
                <span className="text-violet-400">{"{"}</span>
                <span className="text-violet-400">encryptionKey</span>
                <span className="text-violet-400">{"}"}</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-emerald-400">Drop ID</span>
                  <span className="text-muted-foreground/60 ml-1">(path)</span>
                  <p className="text-muted-foreground mt-1">128-bit random identifier for database lookup. Brute-force infeasible (2<sup>128</sup> combinations).</p>
                </div>
                <div>
                  <span className="font-semibold text-amber-400">Access Token</span>
                  <span className="text-muted-foreground/60 ml-1">(query)</span>
                  <p className="text-muted-foreground mt-1">Separate 128-bit token sent to the server for authorization. Wrong or missing token returns a uniform 404.</p>
                </div>
                <div>
                  <span className="font-semibold text-violet-400">Encryption Key</span>
                  <span className="text-muted-foreground/60 ml-1">(fragment)</span>
                  <p className="text-muted-foreground mt-1">256-bit AES key in the URL fragment. Fragments are never sent to servers per the HTTP specification.</p>
                </div>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-consume">Two-Step Consume Flow</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Views are only counted after successful decryption, so network errors or wrong passwords don't waste your view count.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="p-4" data-testid="card-phase-fetch">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2" data-testid="text-phase-fetch">Phase 1 &mdash; Fetch</div>
                <p className="text-sm text-muted-foreground">
                  The recipient's browser calls <code className="text-xs bg-muted px-1 py-0.5 rounded">/consume</code> to download the encrypted ciphertext. No view is counted yet.
                </p>
              </Card>
              <Card className="p-4" data-testid="card-phase-decrypt">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2" data-testid="text-phase-decrypt">Phase 2 &mdash; Decrypt</div>
                <p className="text-sm text-muted-foreground">
                  Decryption happens entirely in the browser using the key from the URL fragment. If a password was set, the key is derived via PBKDF2.
                </p>
              </Card>
              <Card className="p-4" data-testid="card-phase-confirm">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2" data-testid="text-phase-confirm">Phase 3 &mdash; Confirm</div>
                <p className="text-sm text-muted-foreground">
                  Only after successful decryption does the browser call <code className="text-xs bg-muted px-1 py-0.5 rounded">/confirm</code> to increment the view count. If max views are reached, the drop is destroyed.
                </p>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-burn">Three Burn Triggers</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Every drop is ephemeral. You choose how and when it self-destructs.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <FeatureCard
                icon={Clock}
                title="Time-Based Expiry"
                description="Set an expiry from 1 hour to 30 days. Once the time is up, the drop is permanently deleted by an automatic cleanup job."
              />
              <FeatureCard
                icon={Eye}
                title="View Count Limit"
                description="Allow between 1 and 50 successful decryptions. Each confirmed view decrements the counter. When it hits zero, the ciphertext is destroyed."
              />
              <FeatureCard
                icon={Flame}
                title="Wrong Password Burn"
                description="If enabled, a single failed decryption attempt (wrong password) immediately and permanently destroys the drop. No second chances."
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-defenses">Defense in Depth</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Multiple independent security layers ensure that compromising any single component doesn't expose your secrets.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <FeatureCard
                icon={Shield}
                title="Uniform 404 Responses"
                description="Invalid token, expired drop, consumed drop, or non-existent ID all return the same 404 response. Attackers can't distinguish between these states, preventing existence leakage."
              />
              <FeatureCard
                icon={KeyRound}
                title="Referrer-Policy: no-referrer"
                description="The no-referrer policy ensures that the access token in the URL query parameter is never leaked via HTTP Referer headers when navigating away from the page."
              />
              <FeatureCard
                icon={Lock}
                title="Password-Derived Keys (PBKDF2)"
                description="When a password is set, the encryption key is derived using PBKDF2 with SHA-256 and 310,000 iterations. This makes brute-force password attacks computationally expensive."
              />
              <FeatureCard
                icon={Database}
                title="Atomic Database Operations"
                description="All consume and confirm operations use database transactions with row-level locking. Even concurrent requests can't both succeed for a single-view drop."
              />
            </div>
          </section>

          <section className="pb-8">
            <Card className="p-5 border-primary/20" data-testid="card-trust-center-cta">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-primary/15 text-primary shrink-0 mt-0.5">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Want to go deeper?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Our Trust Center documents the full threat model, cryptography parameters, data handling policies, and responsible disclosure process.
                  </p>
                  <Link
                    href="/trust"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    data-testid="link-trust-center-cta"
                  >
                    Visit the Trust Center
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          </section>

        </div>
      </div>
    </Layout>
  );
}
