import { Link, useLocation } from "wouter";
const dropLogo = "/drop-logo.png";
const rectLogo = "/trust-logo-rect.png";

/** Square drop logo — used as the main icon on content pages */
export function DropIcon({ className }: { className?: string }) {
  return (
    <img
      src={dropLogo}
      alt="TrustDrop"
      className={`rounded-md ${className || ""}`}
    />
  );
}

/** Rectangular logo with mix-blend-lighten — used in the navbar for the dark theme */
export function RectLogo({ className }: { className?: string }) {
  return (
    <img
      src={rectLogo}
      alt="TrustDrop"
      className={`mix-blend-lighten ${className || ""}`}
    />
  );
}

/** Custom SVG shield icon with gradient and glow filter — represents security/trust */
export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 72"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="shieldGrad" x1="32" y1="2" x2="32" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(195 55% 50%)" />
          <stop offset="100%" stopColor="hsl(195 55% 36%)" />
        </linearGradient>
        <filter id="shieldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path
        d="M32 4L6 17v19c0 15.5 11 30 26 34 15-4 26-18.5 26-34V17L32 4z"
        fill="url(#shieldGrad)"
        filter="url(#shieldGlow)"
      />
      <path
        d="M32 24v14"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M25 32l7 7 7-7"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Main layout wrapper — provides consistent navbar, footer navigation, and content area. The navbar highlights Create/Retrieve based on the current route. */
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isRetrieve = location.startsWith("/d/");

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/30">
        <Link href="/" className="flex items-center" data-testid="link-home">
          <RectLogo className="h-14" />
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              !isRetrieve
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="link-create"
          >
            Create
          </Link>
          <span
            className={`text-sm font-medium ${
              isRetrieve ? "text-foreground" : "text-muted-foreground"
            }`}
            data-testid="link-retrieve"
          >
            Retrieve
          </span>
        </div>
      </nav>
      <main className="flex-1 flex flex-col items-center px-4 py-12 md:py-16">
        {children}
      </main>
      <footer className="border-t border-border/30 px-6 py-8 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-how-it-works"
            >
              How It Works
            </Link>
            <Link
              href="/compare"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-compare"
            >
              Compare
            </Link>
            <Link
              href="/blog"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-blog"
            >
              Blog
            </Link>
            <Link
              href="/about"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-about"
            >
              About
            </Link>
            <Link
              href="/trust"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-trust-center"
            >
              Trust Center
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-privacy"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-terms"
            >
              Terms & Conditions
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">
            TrustDrop &mdash; Zero-knowledge, one-time secret sharing.
          </p>
        </div>
      </footer>
    </div>
  );
}
