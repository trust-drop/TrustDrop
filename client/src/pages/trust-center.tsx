import { Layout, ShieldIcon } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Shield,
  Lock,
  Eye,
  Clock,
  Flame,
  Database,
  KeyRound,
  Server,
  Globe,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

/* ─── Reusable sub-components ─── */

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{description}</p>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
  accent = "default",
}: {
  icon: typeof Lock;
  title: string;
  description: string;
  accent?: "default" | "emerald" | "red" | "amber";
}) {
  const accents = {
    default: "bg-muted text-foreground",
    emerald: "bg-emerald-500/20 text-emerald-400",
    red: "bg-red-500/20 text-red-400",
    amber: "bg-amber-500/20 text-amber-400",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accents[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </Card>
  );
}

function DiagramSection({
  id,
  title,
  description,
  src,
  alt,
  maxWidth = "max-w-4xl",
}: {
  id: string;
  title: string;
  description: string;
  src: string;
  alt: string;
  maxWidth?: string;
}) {
  return (
    <section id={id}>
      <SectionHeading title={title} description={description} />
      <Card className="p-2 sm:p-4 overflow-x-auto">
        <img
          src={src}
          alt={alt}
          className={`w-full ${maxWidth} mx-auto`}
          loading="lazy"
        />
      </Card>
    </section>
  );
}

/* ─── Main page ─── */

export default function TrustCenter() {
  return (
    <Layout>
      <PageMeta
        title="Trust Center — Security Architecture & Transparency"
        description="TrustDrop's security trust center. Explore our zero-knowledge architecture, encryption flow, attack surface analysis, and data lifecycle — all verifiable, all transparent."
        canonicalPath="/trust"
      />
      <div className="w-full max-w-5xl mx-auto">

        {/* ─── Hero ─── */}
        <div className="flex flex-col items-center mb-12">
          <ShieldIcon className="w-16 h-16 mb-5" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3">
            Trust Center
          </h1>
          <p className="text-muted-foreground text-center max-w-2xl">
            Security isn't a feature — it's TrustDrop's foundation. This page provides full transparency into how we protect your secrets, from architecture to deletion.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-14">

          {/* ─── Quick nav ─── */}
          <nav>
            <Card className="p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">On this page</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { href: "#principles", label: "Security Principles" },
                  { href: "#attack-surface", label: "Attack Surface Diagram" },
                  { href: "#data-flow", label: "Data Flow Diagram" },
                  { href: "#url-anatomy", label: "URL Fragment Security" },
                  { href: "#lifecycle", label: "Secret Lifecycle" },
                  { href: "#guarantees", label: "Guarantees & Commitments" },
                ].map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-primary" />
                    {label}
                  </a>
                ))}
              </div>
            </Card>
          </nav>

          {/* ─── Security Principles ─── */}
          <section id="principles">
            <SectionHeading
              title="Security Principles"
              description="TrustDrop is built on a zero-knowledge architecture. The server is designed to be untrusted — even a complete database compromise yields nothing readable."
            />
            <p className="text-sm text-muted-foreground mb-5 -mt-3">
              <Link
                href="/how-it-works"
                className="text-primary hover:underline font-medium"
                data-testid="link-how-it-works-inline"
              >
                See How It Works →
              </Link>
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoCard
                icon={Shield}
                title="Zero-Knowledge Architecture"
                accent="emerald"
                description="Encryption and decryption happen exclusively in the browser. The server stores only ciphertext it mathematically cannot decrypt — no keys, no plaintext, ever."
              />
              <InfoCard
                icon={Lock}
                title="AES-256-GCM Encryption"
                accent="emerald"
                description="Industry-standard authenticated encryption via the Web Crypto API. Optional password protection uses PBKDF2 with SHA-256 and 310,000 iterations."
              />
              <InfoCard
                icon={KeyRound}
                title="URL Fragment Key Transport"
                accent="emerald"
                description="The decryption key lives in the URL fragment (#), which browsers never send to the server per RFC 3986. The key only exists in the share link and in the recipient's browser memory."
              />
              <InfoCard
                icon={Database}
                title="Atomic Operations"
                accent="emerald"
                description="All consume and confirm operations use database transactions with row-level locking. Even concurrent requests can't both succeed for a single-view drop."
              />
            </div>
          </section>

          {/* ─── Attack Surface Diagram ─── */}
          <DiagramSection
            id="attack-surface"
            title="Attack Surface"
            description="The diagram below maps TrustDrop's data flow across three trust boundaries: the sender's browser (trusted), the server (assumed compromised), and the recipient's browser (trusted)."
            src="/trust-center/attack-surface-diagram.svg"
            alt="TrustDrop attack surface diagram showing trust boundaries and data flow between sender browser, server, and recipient browser"
            maxWidth="max-w-5xl"
          />

          {/* ─── Data Flow Diagram ─── */}
          <DiagramSection
            id="data-flow"
            title="Data Flow"
            description="A swim-lane view of the encryption and decryption lifecycle. Green indicates plaintext (client-side only), blue indicates ciphertext, and red X marks paths where the decryption key is absent."
            src="/trust-center/data-flow-diagram.svg"
            alt="TrustDrop data flow swim lane diagram showing encryption lifecycle with color-coded data states"
          />

          {/* ─── URL Anatomy ─── */}
          <DiagramSection
            id="url-anatomy"
            title="URL Fragment Security"
            description="A visual breakdown of a TrustDrop share link showing exactly which parts are sent to the server in the HTTP request and which parts stay client-side, never leaving the browser."
            src="/trust-center/url-fragment-diagram.svg"
            alt="TrustDrop URL anatomy showing server-sent vs client-only components with RFC 3986 reference"
            maxWidth="max-w-3xl"
          />

          {/* ─── Secret Lifecycle ─── */}
          <DiagramSection
            id="lifecycle"
            title="Secret Lifecycle"
            description="Every secret follows the same path: creation → storage → sharing → retrieval → permanent deletion. Secrets are destroyed under any of three conditions — whichever comes first."
            src="/trust-center/data-lifecycle-diagram.svg"
            alt="TrustDrop secret lifecycle timeline from creation to permanent deletion with three deletion triggers"
            maxWidth="max-w-3xl"
          />

          {/* ─── Deletion Triggers (text detail) ─── */}
          <section>
            <SectionHeading title="Deletion Triggers" />
            <div className="grid sm:grid-cols-3 gap-4">
              <InfoCard
                icon={Eye}
                title="View Limit Reached"
                accent="red"
                description="After the configured number of successful decryptions (default: 1), the ciphertext is permanently destroyed. Each confirmed view decrements the counter."
              />
              <InfoCard
                icon={Clock}
                title="Time Expiry"
                accent="red"
                description="Secrets expire after the configured TTL (1 hour, 24 hours, or 7 days). Expiry and view limits are checked independently."
              />
              <InfoCard
                icon={Flame}
                title="Wrong Password"
                accent="red"
                description="If auto-destruct on wrong password is enabled, a single failed decryption attempt immediately and permanently destroys the drop."
              />
            </div>
            <Card className="p-4 mt-4 border-red-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Once deleted, the ciphertext is permanently removed from the database. There is no recycle bin, no soft-delete, and no recovery mechanism. Deletion is irreversible by design.
                </p>
              </div>
            </Card>
          </section>

          {/* ─── Guarantees ─── */}
          <section id="guarantees" className="pb-8">
            <SectionHeading
              title="Security Guarantees & Commitments"
              description="What we commit to — verifiable through architecture, not just policy."
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoCard
                icon={Server}
                title="Server Compromise Resilience"
                description="Even with full database access, an attacker only gets AES-256-GCM ciphertext with no decryption keys. There is no backdoor, no master key, and no way for anyone — including us — to read your data."
              />
              <InfoCard
                icon={Globe}
                title="No Tracking, No Accounts"
                description="No registration required. No analytics tracking your secrets. No personal data collection. No cookies beyond what's needed to serve the application."
              />
              <InfoCard
                icon={FileCheck}
                title="Uniform Error Responses"
                description="Invalid token, expired drop, consumed drop, and non-existent ID all return the same 404 response. Attackers cannot distinguish between these states, preventing existence leakage."
              />
              <InfoCard
                icon={CheckCircle2}
                title="Referrer Protection"
                description="The no-referrer policy ensures access tokens in URL query parameters are never leaked via HTTP Referer headers when navigating away from the page."
              />
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Want to dive deeper into the technical implementation?
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/how-it-works"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  How It Works →
                </Link>
                <Link
                  href="/about"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  About TrustDrop →
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
