import { Layout } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";

export default function Terms() {
  return (
    <Layout>
      <PageMeta
        title="Terms & Conditions"
        description="Terms of service for using TrustDrop's zero-knowledge encrypted secret sharing platform."
        canonicalPath="/terms"
      />
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3" data-testid="text-terms-title">
          Terms & Conditions
        </h1>
        <p className="text-muted-foreground text-center mb-10">
          Last updated: February 2026
        </p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using TrustDrop, you agree to be bound by these Terms & Conditions. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Service Description</h2>
            <p>
              TrustDrop is a free, zero-knowledge, one-time secret sharing service. It allows you to share encrypted messages and files via one-time links. All encryption and decryption happens in your browser. The server only stores encrypted data it cannot read.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. No Account Required</h2>
            <p>
              TrustDrop does not require account creation, registration, or authentication. No personal information is collected or stored.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Data Handling</h2>
            <p>
              All content is encrypted client-side before being sent to our servers. We store only encrypted ciphertext and minimal metadata (content type, expiration time). Encrypted data is permanently and irrevocably deleted after it is accessed once, or when it expires &mdash; whichever comes first.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Acceptable Use</h2>
            <p>
              You agree not to use TrustDrop for any unlawful purpose or to transmit content that violates applicable laws or regulations. While we cannot inspect the contents of encrypted drops, we reserve the right to limit or terminate access to the service at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. File Size Limits</h2>
            <p>
              File uploads are limited to 50 MB per drop. Drops expire according to the sender's chosen expiration time, up to the maximum allowed by the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. No Warranty</h2>
            <p>
              TrustDrop is provided "as is" without warranties of any kind, either express or implied. We do not guarantee uninterrupted availability, error-free operation, or that the service will meet your specific requirements. Use at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, TrustDrop and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Data Loss</h2>
            <p>
              Due to the one-time nature of the service, once a drop is consumed or expires, the data is permanently destroyed. We are not responsible for data that is lost, inaccessible, or destroyed. You should not use TrustDrop as the sole storage for important information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Law Enforcement & Legal Requests</h2>
            <p className="mb-3">
              We will cooperate with valid legal processes to the extent technically possible. Due to our zero-knowledge architecture, we cannot decrypt any content stored on our servers. We do not log IP addresses or store any identifying information about users.
            </p>
            <p>
              In the event of a lawful request, the most we could provide is encrypted ciphertext (if the drop has not already been consumed or expired), which cannot be decrypted without the encryption key &mdash; a key that never touches our servers. For full details, see our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Changes to Terms</h2>
            <p>
              We may update these terms at any time. Continued use of TrustDrop after changes are posted constitutes acceptance of the updated terms.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
