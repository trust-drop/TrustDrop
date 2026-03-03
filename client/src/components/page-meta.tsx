/**
 * Per-page SEO component — dynamically updates document title, meta description, and Open Graph tags
 * for each page. Renders nothing (returns null). On unmount, resets the title to the default.
 */
import { useEffect } from "react";

interface PageMetaProps {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalPath?: string;
}

export function PageMeta({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  canonicalPath,
}: PageMetaProps) {
  useEffect(() => {
    const fullTitle = `${title} | TrustDrop`;
    document.title = fullTitle;

    setMeta("description", description);
    setMeta("og:title", ogTitle || title, "property");
    setMeta("og:description", ogDescription || description, "property");
    if (ogImage) {
      setMeta("og:image", ogImage, "property");
    }
    if (canonicalPath) {
      setMeta("og:url", `https://trustdrop.com${canonicalPath}`, "property");
    }
    setMeta("twitter:title", ogTitle || title);
    setMeta("twitter:description", ogDescription || description);
    if (ogImage) {
      setMeta("twitter:image", ogImage);
    }

    return () => {
      document.title = "TrustDrop - Share Secrets Securely";
    };
  }, [title, description, ogTitle, ogDescription, ogImage, canonicalPath]);

  return null;
}

/** Finds or creates a meta tag by attribute name/property and sets its content. Creates the element if it doesn't exist (for tags not in the initial HTML). */
function setMeta(key: string, value: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}
