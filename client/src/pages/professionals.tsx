import { Layout } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowDown,
  Scale,
  BarChart3,
  Hospital,
  ShieldCheck,
  KeyRound,
  Flame,
  ShieldAlert,
  EyeOff,
  UserX,
  AlertTriangle,
  Quote,
} from "lucide-react";

interface Profession {
  icon: typeof Scale;
  title: string;
  description: string;
  useCases: string;
}

const professions: Profession[] = [
  {
    icon: Scale,
    title: "Legal",
    description: "Attorney-client privilege means nothing if opposing counsel subpoenas an email chain with credentials in plaintext. Self-destructing links leave no trail.",
    useCases: "Sharing portal logins with clients, transmitting settlement figures, sending document review credentials to co-counsel.",
  },
  {
    icon: BarChart3,
    title: "Financial & Accounting",
    description: "Tax season means hundreds of credential exchanges. Every plaintext email with a client's bank login is a liability sitting in your firm's mail archive.",
    useCases: "Sharing QuickBooks or banking credentials, transmitting EIN/SSN data, sending access to financial portals.",
  },
  {
    icon: Hospital,
    title: "Healthcare & IT",
    description: "PHI breaches carry real penalties. When you need to share system credentials or patient-adjacent data with a vendor, the transmission method matters as much as the access controls.",
    useCases: "EHR system credentials for new staff, sharing access with third-party vendors, transmitting configuration details to IT consultants.",
  },
];

interface Protection {
  icon: typeof ShieldCheck;
  label: string;
  description: string;
}

const protections: Protection[] = [
  {
    icon: ShieldCheck,
    label: "Zero-knowledge encryption",
    description: "Your data is encrypted in your browser before it ever leaves your device. The server stores only ciphertext \u2014 indistinguishable from random noise without the key. Even if our database were breached, your secrets remain encrypted.",
  },
  {
    icon: KeyRound,
    label: "Key never hits the server",
    description: "The decryption key lives in the URL fragment (the part after the #). Per the HTTP specification, fragments are never sent to servers. The key exists only in the link you share and in the recipient's browser memory.",
  },
  {
    icon: Flame,
    label: "Self-destructing links",
    description: "Set a view limit (1\u201350) and an expiry (1 hour to 30 days). Once the conditions are met, the ciphertext is permanently deleted. There's no \"undo\" \u2014 the data is gone from our systems entirely.",
  },
  {
    icon: ShieldAlert,
    label: "Wrong-password kill switch",
    description: "Optionally destroy the secret on the first incorrect password attempt. If someone intercepts the link and guesses wrong, the data is immediately and permanently erased. No second chances.",
  },
  {
    icon: EyeOff,
    label: "No existence leakage",
    description: "Invalid, expired, consumed, and non-existent links all return the same response. An attacker can't even determine whether a secret existed in the first place.",
  },
  {
    icon: UserX,
    label: "No accounts, no metadata",
    description: "Neither you nor your recipient need to create an account. We don't collect names, emails, IP addresses, or usage logs tied to secrets. There's nothing to subpoena and nothing to breach.",
  },
];

interface Step {
  number: string;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: "01",
    title: "Paste your secret",
    description: "Type or paste the credential, message, or upload a file (up to 50 MB). Set a password if you want an extra layer. Choose your burn rules \u2014 view limit and expiry time.",
  },
  {
    number: "02",
    title: "Send the link",
    description: "TrustDrop generates a single share link. Send it to your client via email, text, or secure message. If you set a password, share that through a separate channel.",
  },
  {
    number: "03",
    title: "It self-destructs",
    description: "Your client opens the link, sees the secret, and it's gone \u2014 permanently deleted from our servers. No copies, no backups, no trail. Exactly what responsible data handling looks like.",
  },
];

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "Can TrustDrop read the secrets I share?",
    answer: "No. Encryption and decryption happen entirely in your browser. Our servers store only encrypted data, and the decryption key is never transmitted to us. This is mathematically enforced, not a policy choice \u2014 we couldn't read your secrets even if compelled to.",
  },
  {
    question: "Does my client need to install anything or create an account?",
    answer: "No. They click the link, optionally enter the password you gave them, and see the secret. It works in any modern browser. No downloads, no sign-ups, no friction.",
  },
  {
    question: "What happens if someone intercepts the link?",
    answer: "If you've set a password, they'd still need it to decrypt the content. If you've enabled wrong-password burn, a single incorrect guess permanently destroys the secret. Even without a password, the link only works until the view limit is reached or the expiry passes \u2014 then the data is gone forever.",
  },
  {
    question: "What if my client doesn't open the link in time?",
    answer: "The secret expires and is permanently deleted. You'd simply create a new drop with the same information and send a fresh link. The old ciphertext is already gone from our systems.",
  },
  {
    question: "Is TrustDrop HIPAA / SOC 2 / PCI-DSS compliant?",
    answer: "TrustDrop is not itself certified under these frameworks. However, our zero-knowledge architecture \u2014 client-side AES-256-GCM encryption, no server-side key access, automatic data destruction \u2014 provides technical safeguards that align with the data protection principles these frameworks require. Compliance depends on your organization's complete set of policies and controls.",
  },
  {
    question: "Can I use TrustDrop for files, or just text?",
    answer: "Both. You can share encrypted files up to 50 MB alongside or instead of text. The same zero-knowledge encryption and burn rules apply to file drops.",
  },
];

export default function Professionals() {
  return (
    <Layout>
      <PageMeta
        title="Secure Credential Sharing for Teams & Professionals"
        description="Share passwords, API keys, and sensitive documents with clients and teammates through encrypted self-destructing links. No accounts required."
        canonicalPath="/professionals"
      />
      <div className="w-full max-w-4xl mx-auto">
        <Badge variant="outline" className="mb-6 mx-auto block w-fit text-xs tracking-widest uppercase no-default-hover-elevate no-default-active-elevate" data-testid="badge-professionals-eyebrow">
          For Legal, Financial & Healthcare Professionals
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-6 tracking-tight" data-testid="text-professionals-title">
          Stop sending client secrets<br className="hidden sm:inline" /> over email.
        </h1>
        <p className="text-muted-foreground text-center mb-8 max-w-xl mx-auto text-lg leading-relaxed">
          TrustDrop lets you share passwords, credentials, and sensitive documents through encrypted, self-destructing links. The server never sees your data. No accounts required &mdash; for you or your client.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
          <Link href="/">
            <Button data-testid="button-hero-cta">
              Share a secret now
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <a href="#how-it-protects">
            <Button variant="ghost" data-testid="button-hero-secondary">
              See how it works
              <ArrowDown className="w-4 h-4 ml-1" />
            </Button>
          </a>
        </div>

        <Card className="p-6 md:p-8 mb-16 border-red-400/15 bg-red-400/[0.03]" data-testid="card-problem">
          <h2 className="text-base font-semibold text-red-400 mb-3" data-testid="text-problem-title">The uncomfortable truth about how firms share sensitive data</h2>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Every day, professionals email passwords, tax IDs, case files, and medical records in plaintext. Those messages sit in sent folders, mail servers, and backup systems &mdash; indefinitely. A single compromised inbox exposes every secret you've ever sent through it.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Encrypted attachments help, but you still need to share the password somewhere. Secure portals require your client to create yet another account. The friction means people default to the easy, dangerous option.
          </p>
        </Card>

        <section className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Who this is for</p>
          <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-professions">Built for professionals who handle other people's secrets</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg">Any profession with a duty of confidentiality benefits from ephemeral, encrypted sharing.</p>

          <div className="grid md:grid-cols-3 gap-4">
            {professions.map((prof) => (
              <Card key={prof.title} className="p-5" data-testid={`card-profession-${prof.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <prof.icon className="w-7 h-7 text-primary mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-2">{prof.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{prof.description}</p>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  <span className="font-medium text-muted-foreground">Common uses:</span> {prof.useCases}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-protects" className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Security model</p>
          <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-protections">How TrustDrop protects your clients' data</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg">Every design decision is oriented around one principle: even we can't read your secrets.</p>

          <div className="space-y-0">
            {protections.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-6 py-5 border-b border-border items-baseline"
                data-testid={`protection-${i}`}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm text-foreground">{item.label}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="p-6 md:p-8 mb-16 border-amber-400/15 bg-amber-400/[0.03]" data-testid="card-compliance">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-amber-400 mb-2">A note on compliance</h3>
              <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                TrustDrop is a security tool, not a compliance certification. We don't claim HIPAA, SOC 2, or PCI-DSS certification.
              </p>
              <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                What we do provide is a zero-knowledge architecture where data is encrypted client-side with AES-256-GCM, decryption keys never touch our servers, and secrets are automatically destroyed after use. These properties can support your compliance posture as part of a broader data handling strategy &mdash; but compliance is ultimately about your organization's full set of policies and controls, not any single tool.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If your compliance team has questions about our architecture, our{" "}
                <Link href="/how-it-works" className="text-amber-400 underline underline-offset-2 hover:text-amber-300">
                  technical documentation
                </Link>{" "}
                details exactly how every component works.
              </p>
            </div>
          </div>
        </Card>

        <section className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">In practice</p>
          <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-workflow">Three steps. Thirty seconds. Zero risk.</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg">No software to install. No accounts to create. Works from any browser.</p>

          <div className="grid md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <Card key={step.number} className="p-5" data-testid={`card-step-${step.number}`}>
                <span className="text-3xl font-bold text-primary/20 block mb-2 leading-none">{step.number}</span>
                <h3 className="text-sm font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <div className="border-t border-b border-border py-10 mb-16 text-center" data-testid="social-proof">
          <Quote className="w-6 h-6 text-muted-foreground/30 mx-auto mb-4" />
          <blockquote className="text-lg italic text-foreground max-w-xl mx-auto mb-4 leading-relaxed">
            "We switched from emailing credentials to TrustDrop links and it took five minutes to explain to the whole company. No training needed."
          </blockquote>
          <cite className="text-sm text-muted-foreground not-italic">
            &mdash; Security Director at a national retail company
          </cite>
        </div>

        <section className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Common questions</p>
          <h2 className="text-xl font-semibold text-foreground mb-6" data-testid="text-section-faq">What professionals ask us</h2>

          <div className="space-y-0">
            {faqs.map((faq, i) => (
              <div key={i} className="py-5 border-b border-border" data-testid={`faq-${i}`}>
                <h3 className="font-semibold text-sm text-foreground mb-1.5">{faq.question}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="p-8 md:p-10 mb-8 text-center border-sky-400/15 bg-sky-400/[0.03]" data-testid="card-final-cta">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">
            Your clients trust you with their secrets.<br />Use a tool that earns that trust.
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            No accounts. No data retention. No software to install. Start sharing secrets securely in the next 30 seconds.
          </p>
          <Link href="/">
            <Button data-testid="button-final-cta">
              Create your first drop
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </Card>
      </div>
    </Layout>
  );
}
