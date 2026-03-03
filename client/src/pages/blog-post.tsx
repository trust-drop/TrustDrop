/**
 * Blog post detail page — renders a single published post with markdown content (sanitized with DOMPurify for XSS prevention).
 */
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Calendar, Tag, ArrowLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  breaks: true,
  gfm: true,
});

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);

  const postQuery = useQuery<any>({
    queryKey: ["/api/blog", params.slug],
  });

  // Parses markdown to HTML using marked (GFM mode with line breaks), then sanitizes with DOMPurify to prevent XSS from any embedded HTML in the markdown source.
  const renderedBody = useMemo(() => {
    if (!postQuery.data?.body) return "";
    const rawHtml = marked.parse(postQuery.data.body) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [postQuery.data?.body]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (postQuery.isLoading) {
    return (
      <Layout>
        <div className="w-full max-w-3xl mx-auto">
          <div className="animate-pulse text-muted-foreground text-center">Loading post...</div>
        </div>
      </Layout>
    );
  }

  if (postQuery.isError || !postQuery.data) {
    return (
      <Layout>
        <div className="w-full max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4" data-testid="text-post-not-found">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">This post doesn't exist or has been removed.</p>
          <Link href="/blog">
            <Button variant="outline" data-testid="button-back-to-blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const post = postQuery.data;

  return (
    <Layout>
      <article className="w-full max-w-3xl mx-auto">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8" data-testid="link-back-blog">
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-post-title">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {post.publishedAt && (
              <span className="flex items-center gap-1" data-testid="text-post-date">
                <Calendar className="w-4 h-4" />
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {post.tags?.length > 0 && (
              <span className="flex items-center gap-1" data-testid="text-post-tags">
                <Tag className="w-4 h-4" />
                {post.tags.join(", ")}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="ml-auto"
              data-testid="button-copy-link"
            >
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
          </div>
        </header>

        {/* Tailwind typography plugin classes for styled markdown rendering with dark mode support */}
        <div
          className="prose prose-invert max-w-none
            prose-headings:text-foreground prose-headings:font-semibold
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground
            prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-muted prose-pre:border prose-pre:border-border/50
            prose-blockquote:border-primary/50 prose-blockquote:text-muted-foreground
            prose-li:text-muted-foreground
            prose-hr:border-border/50"
          dangerouslySetInnerHTML={{ __html: renderedBody }}
          data-testid="content-post-body"
        />
      </article>
    </Layout>
  );
}
