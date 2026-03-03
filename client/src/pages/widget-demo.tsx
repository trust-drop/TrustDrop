import { useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { PageMeta } from "@/components/page-meta";
import { Code, Paintbrush, Puzzle } from "lucide-react";
import { Card } from "@/components/ui/card";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-background/80 border border-border rounded-lg p-4 text-sm font-mono text-muted-foreground overflow-x-auto whitespace-pre" data-testid="code-block">
      {children}
    </pre>
  );
}

function WidgetMount({ id, attrs }: { id: string; attrs: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const el = document.createElement("div");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute("data-origin", window.location.origin);
    ref.current.appendChild(el);

    if (typeof (window as any).TrustDropWidget === "function") {
      new (window as any).TrustDropWidget(el);
    }
  }, [id, attrs]);

  return <div ref={ref} />;
}

export default function WidgetDemo() {
  useEffect(() => {
    if (document.querySelector('script[src="/widget.js"]')) return;
    const script = document.createElement("script");
    script.src = "/widget.js";
    document.body.appendChild(script);
  }, []);

  return (
    <Layout>
      <PageMeta
        title="Embeddable Widget Demo — Drop-In Secret Sharing"
        description="Add zero-knowledge encrypted secret sharing to any website with a single script tag. See the TrustDrop widget in action."
        canonicalPath="/widget-demo"
      />
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <Puzzle className="w-3.5 h-3.5" />
            Embeddable Widget
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3" data-testid="text-widget-demo-title">
            Drop-In Secret Sharing
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto" data-testid="text-widget-demo-subtitle">
            Add zero-knowledge encrypted secret sharing to any website with a single script tag.
            Everything encrypts in the browser — your server never sees plaintext.
          </p>
        </div>

        <div className="space-y-8">
          <Card className="p-6" data-testid="card-demo-default">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/15 text-primary">
                <Code className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-semibold">Default Widget</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 ml-11">
              Two lines of HTML. Dark theme modal with full encryption built in.
            </p>
            <div className="ml-11 space-y-4">
              <CodeBlock>{`<script src="https://trustdrop.com/widget.js"></script>\n<div id="trustdrop-widget"></div>`}</CodeBlock>
              <div className="pt-2">
                <WidgetMount id="default" attrs={{ id: "trustdrop-widget" }} />
              </div>
            </div>
          </Card>

          <Card className="p-6" data-testid="card-demo-custom">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/15 text-primary">
                <Paintbrush className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-semibold">Customized Widget</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 ml-11">
              Use data attributes to match your brand — button text, color theme, and accent color.
            </p>
            <div className="ml-11 space-y-4">
              <CodeBlock>{`<div data-trustdrop-widget\n     data-button-text="Send Securely"\n     data-theme="light"\n     data-accent-color="#6366f1"></div>`}</CodeBlock>
              <div className="pt-2">
                <WidgetMount
                  id="custom"
                  attrs={{
                    "data-trustdrop-widget": "",
                    "data-button-text": "Send Securely",
                    "data-theme": "light",
                    "data-accent-color": "#6366f1",
                  }}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6" data-testid="card-demo-options">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/15 text-primary">
                <Puzzle className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-semibold">Configuration Options</h2>
            </div>
            <div className="overflow-x-auto ml-11">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Attribute</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Default</th>
                    <th className="text-left py-2 font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-mono text-xs text-primary">data-button-text</td>
                    <td className="py-2.5 pr-4">"Share a Secret"</td>
                    <td className="py-2.5">Text shown on the trigger button</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-mono text-xs text-primary">data-theme</td>
                    <td className="py-2.5 pr-4">"dark"</td>
                    <td className="py-2.5">"dark" or "light" modal appearance</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-mono text-xs text-primary">data-accent-color</td>
                    <td className="py-2.5 pr-4">#2a7d6e</td>
                    <td className="py-2.5">Primary color for buttons and highlights</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-xs text-primary">data-origin</td>
                    <td className="py-2.5 pr-4">trustdrop.com</td>
                    <td className="py-2.5">API origin for self-hosted instances</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
