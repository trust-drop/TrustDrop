import { Layout } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";

export default function Privacy() {
  return (
    <Layout>
      <PageMeta
        title="Privacy Policy"
        description="How TrustDrop handles your data. Zero-knowledge architecture means we never see your secrets."
        canonicalPath="/privacy"
      />
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3" data-testid="text-privacy-title">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground text-center mb-10">
          Last updated: February 2026
        </p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Zero-Knowledge by Design</h2>
            <p>
              TrustDrop is architected so that we cannot read your data. All encryption and decryption happens exclusively in your browser using the WebCrypto API. Our servers only ever receive and store encrypted ciphertext that is mathematically impossible for us to decrypt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What We Don't Collect</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>No user accounts or registration</li>
              <li>No names, emails, or personal identifiers</li>
              <li>No encryption keys (they never reach our servers)</li>
              <li>No plaintext content (we only receive ciphertext)</li>
              <li>No tracking cookies or analytics profiles</li>
              <li>No IP address logging tied to specific drops</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What We Store</h2>
            <p className="mb-3">
              When you create a drop, we temporarily store the following:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Encrypted ciphertext (which we cannot decrypt)</li>
              <li>Content type indicator (text or file)</li>
              <li>Initialization vector (required for decryption, but useless without the key)</li>
              <li>Expiration timestamp</li>
              <li>Whether a password was used (boolean flag only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Data Retention</h2>
            <p>
              All encrypted data is permanently destroyed under one of two conditions, whichever comes first:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Immediately after the first retrieval (atomic delete)</li>
              <li>When the expiration time is reached (cleanup runs every 60 seconds)</li>
            </ul>
            <p className="mt-3">
              Once destroyed, data cannot be recovered by anyone &mdash; including us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Encryption Details</h2>
            <p>
              We use AES-256-GCM encryption via the browser's native WebCrypto API. For password-protected drops, keys are derived using PBKDF2 with SHA-256 and 310,000 iterations. Encryption keys are either embedded in the URL fragment (which browsers never send to servers per RFC 3986) or derived from a password that only the sender and recipient know.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Security Headers</h2>
            <p>
              We set <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">Referrer-Policy: no-referrer</code> to prevent URL fragments from leaking through referrer headers, and <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">X-Content-Type-Options: nosniff</code> to prevent MIME type sniffing attacks.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Third Parties</h2>
            <p>
              We do not share data with third parties. Since we cannot read the encrypted content, there is nothing meaningful to share.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Law Enforcement & Transparency</h2>
            <p className="mb-3">
              We will comply with valid legal requests, such as subpoenas and court orders, to the extent technically possible. However, our zero-knowledge architecture severely limits what we can provide:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mb-3">
              <li><strong className="text-foreground">We cannot decrypt your data.</strong> Encryption keys never touch our servers. This is not a policy &mdash; it is a technical impossibility built into the architecture.</li>
              <li><strong className="text-foreground">We do not log IP addresses</strong> or associate any identifying information with individual drops.</li>
              <li><strong className="text-foreground">We do not store user accounts,</strong> email addresses, names, or any personal identifiers.</li>
              <li><strong className="text-foreground">Drops are automatically destroyed</strong> after reaching their view limit or upon expiry, so in most cases there is nothing left to produce.</li>
            </ul>
            <p className="mb-3">
              At most, we could provide encrypted ciphertext (if the drop has not yet been consumed or expired), which is mathematically useless without the encryption key that only the sender and recipient possess.
            </p>
            <p>
              We have not received any national security letters, FISA orders, or gag orders as of the date listed above. If legally permitted, we will update this statement should that change.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Any changes will be reflected on this page with an updated date.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
