import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { docFileToSlug, docHref } from "@/lib/docSite";
import { getDocMarkdown, listDocSlugs } from "@/lib/docsContent";

function markdownHrefToSlug(href: string): string | null {
  const trimmed = href.trim().split("#")[0]?.split("?")[0] ?? "";
  if (!trimmed || !/\.md$/i.test(trimmed)) return null;
  const segments = trimmed.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  if (!last) return null;
  if (last.toLowerCase() === "security.md") {
    return docFileToSlug("SECURITY.md");
  }
  return docFileToSlug(`docs/${last}`);
}

function titleizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function DocArticle() {
  const { slug = "" } = useParams<{ slug: string }>();
  const markdown = getDocMarkdown(slug);
  const validSlugs = useMemo(() => new Set(listDocSlugs()), []);

  const components = useMemo<Components>(
    () => ({
      a({ href, children, ...rest }) {
        if (!href) {
          return <a {...rest}>{children}</a>;
        }
        const docSlug = markdownHrefToSlug(href);
        if (docSlug) {
          return (
            <Link to={docHref(docSlug)} className="doc-link">
              {children}
            </Link>
          );
        }
        if (/^https?:\/\//i.test(href)) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          );
        }
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        );
      },
      pre({ children }) {
        return (
          <pre className="docs-md-pre overflow-x-auto rounded-lg border border-primary/20 bg-black/45 p-4 my-4 text-sm leading-relaxed">
            {children}
          </pre>
        );
      },
      code({ className, children, ...rest }) {
        const isBlock = Boolean(className?.includes("language-"));
        if (isBlock) {
          return (
            <code className={cn("font-mono text-[13px] text-[#9BBFBA]", className)} {...rest}>
              {children}
            </code>
          );
        }
        return (
          <code className="docs-cmd text-[0.9em]" {...rest}>
            {children}
          </code>
        );
      },
    }),
    [],
  );

  if (!validSlugs.has(slug)) {
    return <Navigate to="/docs" replace />;
  }

  if (markdown === undefined) {
    return <Navigate to="/docs" replace />;
  }

  return (
    <article className="docs-article pb-16">
      <p className="docs-eyebrow text-[10px] font-mono uppercase tracking-[0.1em] text-[#5eead4]/80 mb-2">
        Documentation
      </p>
      <h1
        className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-8"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {titleizeSlug(slug)}
      </h1>
      <div className="prose prose-invert prose-headings:font-bold prose-headings:tracking-tight max-w-none prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground/95 docs-article-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </div>
      <p className="mt-10 text-sm">
        <Link to="/docs" className="text-primary hover:underline font-medium">
          ← Back to documentation hub
        </Link>
      </p>
    </article>
  );
}
