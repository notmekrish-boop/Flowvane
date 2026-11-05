import { useEffect, useState } from "react";

export default function MermaidPreview({ source, className = "" }) {
  const [rendered, setRendered] = useState({ source: null, svg: "", error: "" });
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  useEffect(() => {
    if (!source.trim()) return undefined;

    let active = true;
    import("mermaid/dist/mermaid.esm.min.mjs")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDark ? "dark" : "default",
          flowchart: { htmlLabels: false }
        });
        return mermaid.render(`flowvane-diagram-${Date.now()}-${Math.random().toString(36).slice(2)}`, source);
      })
      .then(({ svg }) => {
        if (active) setRendered({ source, svg, error: "" });
      })
      .catch((error) => {
        if (active) setRendered({ source, svg: "", error: error?.message || "Mermaid could not render this source." });
      });

    return () => { active = false; };
  }, [source, isDark]);

  const isCurrent = rendered.source === source;
  const loading = Boolean(source.trim()) && !isCurrent;
  const error = !source.trim() ? "Add Mermaid syntax to preview your diagram." : isCurrent ? rendered.error : "";

  return (
    <div className={`relative min-h-56 overflow-auto rounded-xl border border-[var(--fv-border)] bg-[var(--fv-bg)] p-5 ${className}`}>
      {loading && <p className="absolute right-4 top-3 text-xs text-[var(--fv-text-muted)]" role="status">Rendering…</p>}
      {error ? (
        <div className="flex min-h-48 items-center justify-center px-4 text-center">
          <p className="max-w-lg text-sm leading-6 text-rose-400" role="alert">{error}</p>
        </div>
      ) : (
        <div className="mx-auto flex min-h-48 min-w-max items-center justify-center [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: isCurrent ? rendered.svg : "" }} />
      )}
    </div>
  );
}
