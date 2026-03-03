import { Link } from "wouter";
import { Layout, DropIcon } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <PageMeta
        title="This Page Self-Destructed"
        description="The page you're looking for doesn't exist or has already been destroyed."
      />
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4" data-testid="page-not-found">
        <DropIcon className="w-16 h-16 mb-8" />

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4" data-testid="text-404-headline">
          This Page Self-Destructed
        </h1>

        <p className="text-lg text-muted-foreground mb-2" data-testid="text-404-subtext">
          Either you mistyped the URL...
          <br />
          or the secret already vanished.
        </p>

        <p className="text-sm text-muted-foreground/70 max-w-md mt-4 mb-10 leading-relaxed" data-testid="text-404-body">
          TrustDrop deletes content after a single successful retrieval.
          <br />
          Security sometimes looks like emptiness.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          data-testid="link-create-drop"
        >
          Create a Secure Drop
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Layout>
  );
}
