import katex from "katex";
import type { ReactNode } from "react";

// Renders question text that may contain inline math delimited by $...$.
// Only KaTeX output is injected as HTML (KaTeX runs with trust:false and
// throwOnError:false so malformed input degrades to visible source text).

function renderMath(source: string): string {
  try {
    return katex.renderToString(source, {
      throwOnError: false,
      trust: false,
      strict: "ignore",
      output: "html",
    });
  } catch {
    return "";
  }
}

export function MathText({ text, className }: { text: string; className?: string }): ReactNode {
  const parts = text.split(/(\$[^$\n]+\$)/g);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const html = renderMath(part.slice(1, -1));
          if (html) {
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
