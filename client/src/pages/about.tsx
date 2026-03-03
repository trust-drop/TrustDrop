import { Layout, DropIcon } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { Link } from "wouter";
import { Shield, Lock, Eye, Zap } from "lucide-react";

export default function About() {
  return (
    <Layout>
      <PageMeta
        title="About TrustDrop — Privacy-First Secret Sharing"
        description="TrustDrop is a zero-knowledge secret sharing platform. We never see your data — encryption happens entirely in your browser."
        canonicalPath="/about"
      />
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex flex-col items-center mb-10">
          <DropIcon className="w-20 h-20 mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3" data-testid="text-about-title">
            About TrustDrop
          </h1>
          <p className="text-muted-foreground text-center max-w-xl">
            A zero-knowledge, one-time secret sharing tool built on the principle that the best way to protect data is to never have access to it in the first place.
          </p>
        </div>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Why TrustDrop?</h2>
            <p>
              Every day, people share passwords, API keys, private notes, and sensitive files through channels that weren't designed for security &mdash; email, chat, text messages. These leave permanent copies scattered across servers, databases, and backups that can be compromised months or years later.
            </p>
            <p className="mt-3">
              TrustDrop takes a fundamentally different approach: your secrets are encrypted in your browser before they ever touch a network. The server stores only ciphertext it mathematically cannot decrypt. Once retrieved, the data is permanently destroyed. No copies, no backups, no traces.
            </p>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 p-5 bg-card/60">
              <Shield className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Zero Knowledge</h3>
              <p className="text-sm text-muted-foreground">
                The server never sees plaintext or encryption keys. Even a full database breach yields nothing useful.
              </p>
            </div>
            <div className="rounded-xl border border-border/50 p-5 bg-card/60">
              <Lock className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Military-Grade Encryption</h3>
              <p className="text-sm text-muted-foreground">
                AES-256-GCM with WebCrypto API. PBKDF2 key derivation with 310,000 iterations for password mode.
              </p>
            </div>
            <div className="rounded-xl border border-border/50 p-5 bg-card/60">
              <Eye className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">One-Time View</h3>
              <p className="text-sm text-muted-foreground">
                Atomic database transactions ensure exactly one retrieval. After that, the data is gone forever.
              </p>
            </div>
            <div className="rounded-xl border border-border/50 p-5 bg-card/60">
              <Zap className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No Accounts Needed</h3>
              <p className="text-sm text-muted-foreground">
                No registration, no tracking, no personal data collection. Just paste, encrypt, share, done.
              </p>
            </div>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Our Philosophy</h2>
            <p>
              We believe privacy is a right, not a feature. TrustDrop is designed so that even we can't access your data &mdash; by architecture, not by policy. The encryption keys travel through a channel (URL fragments) that the server physically cannot observe, per the HTTP specification.
            </p>
            <p className="mt-3">
              This isn't security theater. It's math.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Open & Transparent</h2>
            <p>
              Want to understand exactly how TrustDrop protects your data? Check out our{" "}
              <Link href="/how-it-works" className="text-primary hover:underline" data-testid="link-how-it-works-from-about">
                architecture diagram
              </Link>{" "}
              for a complete visual walkthrough of the zero-knowledge flow.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
