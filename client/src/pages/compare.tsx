import { Layout } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

type ChipColor = "green" | "yellow" | "red" | "neutral";

function Chip({ color, children }: { color: ChipColor; children: React.ReactNode }) {
  const colors: Record<ChipColor, string> = {
    green: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
    yellow: "bg-amber-400/12 text-amber-400 border-amber-400/20",
    red: "bg-red-400/10 text-red-400 border-red-400/20",
    neutral: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium border ${colors[color]}`} data-testid="chip">
      {children}
    </span>
  );
}

function Detail({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{children}</span>;
}

const toolColors = {
  trustdrop: "bg-sky-400",
  ots: "bg-fuchsia-400",
  privatebin: "bg-lime-400",
  bwsend: "bg-blue-400",
};

const tagColors = {
  trustdrop: "bg-sky-400/10 text-sky-400 border-sky-400/20",
  ots: "bg-fuchsia-400/10 text-fuchsia-400 border-fuchsia-400/20",
  privatebin: "bg-lime-400/10 text-lime-400 border-lime-400/20",
  bwsend: "bg-blue-400/10 text-blue-400 border-blue-400/20",
};

type ToolTag = keyof typeof tagColors;

interface TableRow {
  feature: string;
  cells: {
    chip: { color: ChipColor; label: string };
    detail?: string;
  }[];
}

const tableData: TableRow[] = [
  {
    feature: "Encryption Model",
    cells: [
      { chip: { color: "green", label: "Client-side" }, detail: "AES-256-GCM in the browser. Server never sees plaintext or keys." },
      { chip: { color: "yellow", label: "Server-side" }, detail: "Encrypted on the server. Passphrase hashed with bcrypt, but the server handles encryption." },
      { chip: { color: "green", label: "Client-side" }, detail: "AES-256-GCM in the browser. The server stores only ciphertext." },
      { chip: { color: "green", label: "Client-side" }, detail: "AES-256 via Bitwarden client. Key in the URL fragment." },
    ],
  },
  {
    feature: "Zero-Knowledge Architecture",
    cells: [
      { chip: { color: "green", label: "Yes" }, detail: "Encryption key exists only in the URL fragment, never transmitted to server." },
      { chip: { color: "red", label: "No" }, detail: "Server performs encryption. Passphrase is sent to server for hashing." },
      { chip: { color: "green", label: "Yes" }, detail: "Key in the URL fragment. Server sees only ciphertext." },
      { chip: { color: "green", label: "Yes" }, detail: "Key in the URL fragment. Bitwarden servers store only encrypted data." },
    ],
  },
  {
    feature: "Account Required",
    cells: [
      { chip: { color: "green", label: "No" }, detail: "Fully anonymous. No sign-up to create or retrieve." },
      { chip: { color: "yellow", label: "Optional" }, detail: "Anonymous: 7-day / 100 KB limit. Free account: 14-day / 1 MB limit." },
      { chip: { color: "green", label: "No" }, detail: "Fully anonymous on public instances." },
      { chip: { color: "red", label: "Yes" }, detail: "Requires a Bitwarden account to create Sends. Recipients don't need one." },
    ],
  },
  {
    feature: "URL Security",
    cells: [
      { chip: { color: "green", label: "3-part URL" }, detail: "Separate Drop ID, Access Token, and Encryption Key. Compromising one doesn't expose the others." },
      { chip: { color: "neutral", label: "Simple link" }, detail: "Single secret URL. Passphrase sent separately if used." },
      { chip: { color: "yellow", label: "2-part URL" }, detail: "Paste ID + key in fragment. No separate access token layer." },
      { chip: { color: "yellow", label: "2-part URL" }, detail: "Send ID + encryption key in fragment. No separate authorization token." },
    ],
  },
  {
    feature: "View Counting",
    cells: [
      { chip: { color: "green", label: "Two-step consume" }, detail: "View only counted after successful decryption is confirmed. Failed attempts don't waste views." },
      { chip: { color: "red", label: "On access" }, detail: "View counted when the link is opened, regardless of whether the passphrase is correct." },
      { chip: { color: "red", label: "On access" }, detail: "\"Burn after reading\" triggers on first access, even if decryption fails." },
      { chip: { color: "red", label: "On access" }, detail: "Access count increments when the link is opened, before the content is viewed." },
    ],
  },
  {
    feature: "Wrong-Password Burn",
    cells: [
      { chip: { color: "green", label: "Yes" }, detail: "Optional. A single wrong password permanently destroys the drop. Ultimate anti-brute-force." },
      { chip: { color: "red", label: "No" } },
      { chip: { color: "red", label: "No" } },
      { chip: { color: "red", label: "No" } },
    ],
  },
  {
    feature: "Max View Limit",
    cells: [
      { chip: { color: "green", label: "1\u201350 views" }, detail: "Configurable. Auto-destroys when limit is reached." },
      { chip: { color: "neutral", label: "1 view only" }, detail: "Single view, then destroyed. No multi-view option." },
      { chip: { color: "yellow", label: "1 or unlimited" }, detail: "\"Burn after reading\" (1 view) or persist until expiry. No middle ground." },
      { chip: { color: "green", label: "Configurable" }, detail: "Set a custom maximum access count." },
    ],
  },
  {
    feature: "Expiry Options",
    cells: [
      { chip: { color: "green", label: "1 hour \u2013 30 days" } },
      { chip: { color: "yellow", label: "Up to 7 or 14 days" }, detail: "7 days anonymous, 14 days with account." },
      { chip: { color: "green", label: "5 min \u2013 never" }, detail: "Very flexible. Can even set pastes that don't expire." },
      { chip: { color: "green", label: "1 hour \u2013 31 days" }, detail: "Custom timestamps supported." },
    ],
  },
  {
    feature: "Uniform Error Responses",
    cells: [
      { chip: { color: "green", label: "Yes" }, detail: "Invalid, expired, consumed, and non-existent all return identical 404s. No existence leakage." },
      { chip: { color: "red", label: "No" }, detail: "Different messages for \"already viewed\" vs \"unknown.\"" },
      { chip: { color: "red", label: "No" }, detail: "Different error states for invalid vs expired pastes." },
      { chip: { color: "yellow", label: "Partial" }, detail: "Expired Sends show a distinct message vs invalid links." },
    ],
  },
  {
    feature: "File Sharing",
    cells: [
      { chip: { color: "green", label: "Text + files" }, detail: "Encrypted file sharing up to 50 MB. No account required." },
      { chip: { color: "neutral", label: "Text only" } },
      { chip: { color: "green", label: "Text + files" }, detail: "Supports file attachments with encryption." },
      { chip: { color: "green", label: "Text + files" }, detail: "Up to 500 MB files (Premium). Free accounts: text only." },
    ],
  },
  {
    feature: "Open Source",
    cells: [
      { chip: { color: "green", label: "Yes" }, detail: "AGPL-3.0 on GitHub. Verify our zero-knowledge claims yourself." },
      { chip: { color: "green", label: "Yes" }, detail: "Ruby codebase on GitHub." },
      { chip: { color: "green", label: "Yes" }, detail: "PHP codebase. Self-hostable." },
      { chip: { color: "green", label: "Yes" }, detail: "Bitwarden is open-source. Self-hostable." },
    ],
  },
  {
    feature: "Self-Hostable",
    cells: [
      { chip: { color: "green", label: "Yes" }, detail: "AGPL-3.0 codebase on GitHub. Docker setup guide coming soon." },
      { chip: { color: "green", label: "Yes" } },
      { chip: { color: "green", label: "Yes" } },
      { chip: { color: "green", label: "Yes" } },
    ],
  },
  {
    feature: "Pricing",
    cells: [
      { chip: { color: "green", label: "Free" } },
      { chip: { color: "green", label: "Free" }, detail: "Paid plans for custom domains and branding." },
      { chip: { color: "green", label: "Free" }, detail: "Self-hosted or use public instances." },
      { chip: { color: "yellow", label: "Freemium" }, detail: "Text Sends free. File Sends require Premium ($10/yr)." },
    ],
  },
];

interface DeepDive {
  tag: ToolTag;
  tagLabel: string;
  title: string;
  description: string;
}

const deepDives: DeepDive[] = [
  {
    tag: "trustdrop",
    tagLabel: "TrustDrop",
    title: "Security-first secret sharing",
    description: "TrustDrop is purpose-built for one thing: sharing secrets with the strongest possible security guarantees. The three-part URL means compromising any single component (database, server logs, network traffic) doesn't expose your secret. The two-step consume flow means network glitches and wrong passwords don't burn your views. Wrong-password burn is a kill switch no other tool offers. And the entire codebase is open source under AGPL-3.0 — every zero-knowledge claim is verifiable by reading the code.",
  },
  {
    tag: "ots",
    tagLabel: "OneTimeSecret",
    title: "Simplicity and name recognition",
    description: "OneTimeSecret has been around since 2011 and is the tool most people think of first. It's dead simple \u2014 paste, share, done. But the encryption happens server-side, which means you're trusting their infrastructure with your plaintext (briefly). For low-stakes secrets, this may be fine. For anything sensitive, the trust model is weaker.",
  },
  {
    tag: "privatebin",
    tagLabel: "PrivateBin",
    title: "Self-hosting and flexibility",
    description: "PrivateBin is the gold standard for self-hosters. If you want total control over the infrastructure, PrivateBin with your own server is hard to beat. It also supports file uploads, comments, and syntax highlighting. The tradeoff: you need to set it up, maintain it, and its security history includes several XSS and file inclusion CVEs over the years.",
  },
  {
    tag: "bwsend",
    tagLabel: "Bitwarden Send",
    title: "Integrated into your password manager",
    description: "If your team already uses Bitwarden, Send is incredibly convenient \u2014 it lives right inside the vault UI. File sharing up to 500 MB is a major advantage. The downsides: the sender needs an account, there's no wrong-password protection, and the free tier is limited to text only. It's more of a feature than a standalone tool.",
  },
];

interface UseCase {
  title: string;
  recommendation: string;
  description: string;
}

const useCases: UseCase[] = [
  {
    title: "Sharing API keys or credentials with a contractor",
    recommendation: "TrustDrop",
    description: "No account needed on either side. Set it to 1 view, enable wrong-password burn, and the key self-destructs the moment it's read \u2014 or if anyone guesses wrong.",
  },
  {
    title: "Quick, low-stakes password share with a friend",
    recommendation: "TrustDrop",
    description: "Just as fast and simple as any other tool \u2014 paste, share, done. But you also get zero-knowledge encryption and configurable burn rules at no extra effort. There's no reason to settle for weaker security, even for low-stakes secrets.",
  },
  {
    title: "Internal tool for your company, self-hosted",
    recommendation: "TrustDrop or PrivateBin",
    description: "TrustDrop is open source (AGPL-3.0) and self-hostable with stronger security features out of the box \u2014 three-part URLs, two-step consume, and wrong-password burn. PrivateBin is a solid alternative if you want extras like syntax highlighting and comments.",
  },
  {
    title: "Sending encrypted files to a colleague",
    recommendation: "TrustDrop or Bitwarden Send",
    description: "TrustDrop supports encrypted file sharing up to 50 MB today with no account required. Bitwarden Send handles up to 500 MB but requires a Premium account ($10/yr). As we scale past our MVP, TrustDrop is targeting 500 MB\u20131 GB file uploads while maintaining our zero-knowledge architecture.",
  },
  {
    title: "High-security scenario (legal, medical, financial)",
    recommendation: "TrustDrop",
    description: "When the stakes are high, you want zero-knowledge, uniform 404s (no existence leakage), and the option to destroy on wrong password. TrustDrop's defense-in-depth model is built for this.",
  },
  {
    title: "Sharing secrets from your terminal / CI pipeline",
    recommendation: "OneTimeSecret or Bitwarden Send",
    description: "Both offer CLI tools and API access. OneTimeSecret is open-source with a straightforward API. Bitwarden's CLI integrates with existing vault workflows.",
  },
];

const toolHeaders = [
  { label: "TrustDrop", dotColor: toolColors.trustdrop },
  { label: "OneTimeSecret", dotColor: toolColors.ots },
  { label: "PrivateBin", dotColor: toolColors.privatebin },
  { label: "Bitwarden Send", dotColor: toolColors.bwsend },
];

export default function Compare() {
  return (
    <Layout>
      <PageMeta
        title="TrustDrop vs OneTimeSecret, Yopass & Others"
        description="See how TrustDrop compares to OneTimeSecret, Yopass, Password Pusher, and Privnote. True zero-knowledge encryption with file support and configurable burn rules."
        canonicalPath="/compare"
      />
      <div className="w-full max-w-5xl mx-auto">
        <Badge variant="outline" className="mb-6 mx-auto block w-fit text-xs tracking-widest uppercase no-default-hover-elevate no-default-active-elevate" data-testid="badge-comparison-guide">
          Comparison Guide &mdash; 2026
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-4 tracking-tight" data-testid="text-compare-title">
          Secure Secret Sharing:<br className="hidden sm:inline" /> How Do the Top Tools Compare?
        </h1>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          An honest look at TrustDrop, OneTimeSecret, PrivateBin, and Bitwarden Send &mdash; what each does well, where they fall short, and which one fits your use case.
        </p>

        <Card className="p-6 md:p-8 mb-12" data-testid="card-tldr">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground mb-3">TL;DR</h2>
          <p className="text-sm text-muted-foreground mb-2">
            All four tools encrypt your data and let you share it via a link. The differences are in <strong className="text-foreground">where encryption happens</strong>, <strong className="text-foreground">how burn rules work</strong>, and <strong className="text-foreground">what the recipient needs</strong> to open the secret.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">TrustDrop</strong> is the only tool that combines true client-side zero-knowledge encryption with a two-step consume flow (views aren't wasted on failures), wrong-password burn protection, and a three-part URL that keeps the encryption key completely off the server.
          </p>
        </Card>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-table">Feature-by-Feature Comparison</h2>
          <p className="text-sm text-muted-foreground mb-5">Scroll horizontally on mobile to see all columns.</p>

          <div className="overflow-x-auto rounded-lg border border-border" data-testid="table-comparison">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr>
                  <th className="bg-muted/50 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground border-b border-border w-[200px]">
                    Feature
                  </th>
                  {toolHeaders.map((tool) => (
                    <th key={tool.label} className="bg-muted/50 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground border-b border-border">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${tool.dotColor}`} />
                      {tool.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap border-b border-border" data-testid={`td-feature-${rowIdx}`}>
                      {row.feature}
                    </td>
                    {row.cells.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-5 py-4 border-b border-border align-top">
                        <Chip color={cell.chip.color}>{cell.chip.label}</Chip>
                        {cell.detail && <Detail>{cell.detail}</Detail>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-deep-dives">What Each Tool Does Best</h2>
          <p className="text-sm text-muted-foreground mb-5">Every tool has its strengths. Here's an honest breakdown.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {deepDives.map((dive) => (
              <Card key={dive.tag} className="p-5" data-testid={`card-deepdive-${dive.tag}`}>
                <span className={`inline-block text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded border mb-3 ${tagColors[dive.tag]}`}>
                  {dive.tagLabel}
                </span>
                <h3 className="text-sm font-semibold text-foreground mb-2">{dive.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{dive.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-section-use-cases">Which Tool Should You Use?</h2>
          <p className="text-sm text-muted-foreground mb-5">It depends on your situation.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {useCases.map((uc, i) => (
              <Card key={i} className="p-5" data-testid={`card-usecase-${i}`}>
                <h3 className="text-sm font-semibold text-foreground mb-1">{uc.title}</h3>
                <p className="text-xs font-medium text-sky-400 mb-2 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  {uc.recommendation}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{uc.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card className="p-6 md:p-8 mb-8 border-sky-400/15 bg-sky-400/[0.03]" data-testid="card-verdict">
          <h2 className="text-lg font-semibold text-foreground mb-3">The Bottom Line</h2>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Every tool on this list is a better choice than emailing passwords in plaintext. But if you care about the security details &mdash; where encryption happens, whether views are wasted on failures, whether an attacker can even tell a secret exists &mdash; TrustDrop is built to get those details right.
          </p>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            No account. No setup. No trust required. The entire codebase is open source under AGPL-3.0 &mdash; every claim on this page is verifiable by reading the code. Just paste your secret, set your rules, and share the link.
          </p>
          <Link href="/">
            <Button data-testid="button-try-trustdrop">
              Try TrustDrop &mdash; it's free
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </Card>

        <p className="text-xs text-muted-foreground/60 text-center pb-4">
          Comparison last updated March 2026. Information sourced from each tool's official documentation.
        </p>
      </div>
    </Layout>
  );
}
