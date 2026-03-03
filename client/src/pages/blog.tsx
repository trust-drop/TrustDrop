import { Layout } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, Tag, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Blog() {
  const postsQuery = useQuery<any[]>({
    queryKey: ["/api/blog"],
  });

  return (
    <Layout>
      <PageMeta
        title="Blog — Privacy, Encryption & Secure Communication"
        description="Insights and guides on password security, encrypted sharing, and protecting sensitive data online."
        canonicalPath="/blog"
      />
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex flex-col items-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-3" data-testid="text-blog-title">
            Blog
          </h1>
          <p className="text-muted-foreground text-center max-w-xl">
            Insights on privacy, encryption, and secure communication.
          </p>
        </div>

        {postsQuery.isLoading ? (
          <div className="animate-pulse text-muted-foreground text-center">Loading posts...</div>
        ) : postsQuery.data?.length === 0 ? (
          <p className="text-muted-foreground text-center">No posts published yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {postsQuery.data?.map((post: any) => (
              <Link key={post.id} href={`/blog/${post.slug}`} data-testid={`link-post-${post.slug}`}>
                <Card className="hover-elevate cursor-pointer transition-colors h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col flex-1">
                    <h2 className="text-base font-semibold text-foreground mb-2 line-clamp-2" data-testid={`text-post-title-${post.slug}`}>
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex flex-col gap-2 mt-auto">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground/70 flex-wrap">
                        {post.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(post.publishedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {post.tags?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {post.tags.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-primary">
                        Read more <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
