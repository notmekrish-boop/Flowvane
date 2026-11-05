import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MermaidPreview from "../components/MermaidPreview";
import DiagramCanvas, { EMPTY_VISUAL_DATA } from "../components/DiagramCanvas";
import { Download, FileCode2, LoaderCircle, Plus, Save, Sparkles, Trash2, Workflow } from "../components/icons";
import { API_URL } from "../lib/api.js";

const DEFAULT_SOURCE = "flowchart TD\n  Start([Start]) --> Plan[Plan the work]\n  Plan --> Build[Build a first version]\n  Build --> Review{Ready to share?}\n  Review -- Yes --> Finish([Done])\n  Review -- Not yet --> Build";
const TYPES = [
  ["FLOWCHART", "Flowchart"],
  ["MIND_MAP", "Mind map"],
  ["ARCHITECTURE", "Architecture"],
  ["SWIMLANE", "Swimlane"],
  ["DECISION_TREE", "Decision tree"],
  ["PROCESS", "Process"]
];

export default function DiagramStudio() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const noteId = searchParams.get("noteId") || "";
  const [diagrams, setDiagrams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [visualData, setVisualData] = useState(EMPTY_VISUAL_DATA);
  const [editorMode, setEditorMode] = useState("visual");
  const [type, setType] = useState("FLOWCHART");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const previewRef = useRef(null);

  const request = useCallback(async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Diagram request failed.");
    return result;
  }, [token]);

  const loadDiagrams = useCallback(async (signal) => {
    try {
      const query = noteId ? `?noteId=${encodeURIComponent(noteId)}` : projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const [diagramResult, projectResult] = await Promise.all([
        request(`/diagrams${query}`),
        request("/projects")
      ]);
      if (signal?.aborted) return;
      const items = diagramResult.diagrams || [];
      const next = items[0] || null;
      setDiagrams(items);
      setProjects(projectResult.projects || []);
      setSelectedId(next?.id || null);
      if (next) {
        setTitle(next.title);
        setSource(next.source);
        setType(next.type);
        setVisualData(next.visualData || EMPTY_VISUAL_DATA);
        setDirty(false);
      } else {
        setTitle("");
        setSource(DEFAULT_SOURCE);
        setType("FLOWCHART");
        setVisualData(EMPTY_VISUAL_DATA);
        setDirty(false);
      }
    } catch (requestError) {
      if (!signal?.aborted) setError(requestError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [noteId, projectId, request]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => loadDiagrams(controller.signal));
    return () => controller.abort();
  }, [loadDiagrams]);

  const selected = useMemo(() => diagrams.find((diagram) => diagram.id === selectedId) || null, [diagrams, selectedId]);

  function selectDiagram(diagram) {
    setSelectedId(diagram.id);
    setTitle(diagram.title);
    setSource(diagram.source);
    setType(diagram.type);
    setVisualData(diagram.visualData || EMPTY_VISUAL_DATA);
    setDirty(false);
  }

  async function createDiagram() {
    setError("");
    setSaving(true);
    try {
      const payload = {
        title: "Untitled diagram",
        source: DEFAULT_SOURCE,
        type: "FLOWCHART",
        visualData: EMPTY_VISUAL_DATA,
        ...(projectId ? { projectId } : {}),
        ...(noteId ? { noteId } : {})
      };
      const result = await request("/diagrams", { method: "POST", body: JSON.stringify(payload) });
      setDiagrams((items) => [result.diagram, ...items]);
      setSelectedId(result.diagram.id);
      setTitle(result.diagram.title);
      setSource(result.diagram.source);
      setType(result.diagram.type);
      setVisualData(result.diagram.visualData || EMPTY_VISUAL_DATA);
      setDirty(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDiagram(event) {
    event?.preventDefault();
    if (!selected || !dirty || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await request(`/diagrams/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim() || "Untitled diagram", source, type, visualData })
      });
      setDiagrams((items) => items.map((diagram) => diagram.id === selected.id ? result.diagram : diagram));
      setTitle(result.diagram.title);
      setSource(result.diagram.source);
      setType(result.diagram.type);
      setVisualData(result.diagram.visualData || EMPTY_VISUAL_DATA);
      setDirty(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function generateDiagram(event) {
    event.preventDefault();
    if (!generationPrompt.trim() || generating || saving) return;
    if (dirty && !window.confirm("Replace the current unsaved diagram source with a newly generated version?")) return;
    setGenerating(true);
    setError("");
    try {
      const result = await request("/diagrams/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: generationPrompt.trim(), type,
          ...(projectId ? { projectId } : {}),
          ...(noteId ? { noteId } : {})
        })
      });
      setSource(result.source);
      if (!title.trim() || title === "Untitled diagram") setTitle(result.title);
      setDirty(true);
      setEditorMode("source");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setGenerating(false);
    }
  }

  async function deleteDiagram() {
    if (!selected || !window.confirm(`Delete “${selected.title}”? This cannot be undone.`)) return;
    setError("");
    try {
      await request(`/diagrams/${selected.id}`, { method: "DELETE" });
      const remaining = diagrams.filter((diagram) => diagram.id !== selected.id);
      setDiagrams(remaining);
      const next = remaining[0] || null;
      setSelectedId(next?.id || null);
      setTitle(next?.title || "");
      setSource(next?.source || DEFAULT_SOURCE);
      setType(next?.type || "FLOWCHART");
      setVisualData(next?.visualData || EMPTY_VISUAL_DATA);
      setDirty(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function setField(setter, value) {
    setter(value);
    setDirty(true);
  }

  function replaceSourceFromCanvas(layout) {
    if (!layout.nodes.length) {
      setError("Add at least one visual node before replacing the Mermaid source.");
      return;
    }
    if (!window.confirm("Replace the current Mermaid source with a flowchart generated from these visual nodes and connections? Unsupported Mermaid details will not carry over.")) return;
    const identifiers = new Map(layout.nodes.map((node, index) => [node.id, `step_${index + 1}`]));
    const lines = ["flowchart TD", ...layout.nodes.map((node) => `  ${identifiers.get(node.id)}[${JSON.stringify(node.label || "Untitled node")}]`), ...layout.edges.map((edge) => `  ${identifiers.get(edge.source)} --> ${identifiers.get(edge.target)}`)];
    setField(setSource, lines.join("\n"));
    setError("");
  }

  function downloadSource() {
    const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title.trim() || "flowvane-diagram").replace(/[^a-z0-9-_]+/gi, "-")}.mmd`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadSvg() {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) {
      setError("Render a valid diagram before exporting it as SVG.");
      return;
    }
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title.trim() || "flowvane-diagram").replace(/[^a-z0-9-_]+/gi, "-")}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectedProject = projects.find((project) => project.id === projectId);
  const heading = noteId ? "Note diagrams" : selectedProject ? `${selectedProject.name} diagrams` : "Diagram Studio";
  const scopeDescription = noteId ? "Private to the linked note and its owner." : selectedProject ? "Shared with members of this project." : "Personal diagrams, ready to connect to a project.";

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[var(--fv-bg)] p-4 text-[var(--fv-text)] md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] md:text-3xl">{heading}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--fv-text-secondary)]">{scopeDescription} Write Mermaid syntax and see the diagram update as you work.</p>
          </div>
          {!noteId && (
            <label className="flex items-center gap-2 text-sm text-[var(--fv-text-secondary)]">
              <span className="sr-only">Diagram scope</span>
              <select
                value={projectId}
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams);
                  if (event.target.value) next.set("projectId", event.target.value);
                  else next.delete("projectId");
                  setSearchParams(next);
                }}
                className="min-h-10 rounded-lg border border-[var(--fv-border)] bg-[var(--fv-surface)] px-3 text-sm text-[var(--fv-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#7068FF]/40"
              >
                <option value="">Personal diagrams</option>
                {projects.map((project) => <option key={project.id} value={project.id}>Project: {project.name}</option>)}
              </select>
            </label>
          )}
        </header>

        {error && <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300" role="alert">{error}</p>}

        <div className="grid min-h-[680px] grid-cols-1 overflow-hidden rounded-2xl border border-[var(--fv-border)] bg-[var(--fv-surface)] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="flex min-h-72 flex-col border-b border-[var(--fv-border)] bg-[var(--fv-surface)] p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fv-text-muted)]">Diagrams</h2>
              <button type="button" onClick={createDiagram} disabled={saving || loading} aria-label="Create diagram" className="rounded-lg p-2 text-[var(--fv-accent)] transition hover:bg-[var(--fv-accent-soft)] focus-visible:outline-2 focus-visible:outline-[#7068FF] disabled:opacity-40"><Plus size={17} /></button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto">
              {loading ? <p className="px-2 py-4 text-sm text-[var(--fv-text-muted)]" role="status">Loading diagrams…</p> : diagrams.map((diagram) => (
                <button key={diagram.id} type="button" onClick={() => selectDiagram(diagram)} className={`w-full rounded-lg px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-[#7068FF] ${diagram.id === selectedId ? "bg-[var(--fv-accent-soft)] text-[var(--fv-text)]" : "text-[var(--fv-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--fv-text)]"}`}>
                  <span className="block truncate text-sm font-medium">{diagram.title}</span>
                  <span className="mt-1 block text-xs text-[var(--fv-text-muted)]">{TYPES.find(([value]) => value === diagram.type)?.[1] || "Diagram"} · {new Date(diagram.updatedAt).toLocaleDateString("en-IN")}</span>
                </button>
              ))}
              {!loading && diagrams.length === 0 && <p className="px-2 py-5 text-sm leading-6 text-[var(--fv-text-muted)]">No diagrams here yet. Create one to start mapping an idea.</p>}
            </div>
            <button type="button" onClick={createDiagram} disabled={saving || loading} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--fv-border)] px-3 text-sm font-medium text-[var(--fv-text-secondary)] transition hover:bg-white/[0.04] hover:text-[var(--fv-text)] focus-visible:outline-2 focus-visible:outline-[#7068FF] disabled:opacity-40"><Plus size={15} /> New diagram</button>
          </aside>

          <section className="flex min-w-0 flex-col">
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <span className="mb-4 rounded-xl bg-[var(--fv-accent-soft)] p-3 text-[var(--fv-accent)]"><Workflow size={22} /></span>
                <h2 className="text-lg font-semibold">Start with a diagram</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--fv-text-secondary)]">Create a flowchart, mind map, architecture sketch, or process map using Mermaid syntax.</p>
                <button type="button" onClick={createDiagram} disabled={saving || loading} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--fv-accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] disabled:opacity-40"><Plus size={16} /> Create diagram</button>
              </div>
            ) : (
              <>
                <form onSubmit={saveDiagram} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fv-border)] p-4 md:px-6">
                  <div className="flex min-w-[220px] flex-1 items-center gap-3">
                    <label htmlFor="diagram-title" className="sr-only">Diagram title</label>
                    <input id="diagram-title" value={title} onChange={(event) => setField(setTitle, event.target.value)} maxLength={160} className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-[var(--fv-text)] outline-none placeholder:text-[var(--fv-text-muted)] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#7068FF]/40" placeholder="Untitled diagram" />
                    <label htmlFor="diagram-type" className="sr-only">Diagram type</label>
                    <select id="diagram-type" value={type} onChange={(event) => setField(setType, event.target.value)} className="max-w-36 rounded-lg border border-[var(--fv-border)] bg-[var(--fv-bg)] px-2.5 py-2 text-xs text-[var(--fv-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[#7068FF]/40">
                      {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mr-1 hidden text-xs text-[var(--fv-text-muted)] sm:inline" aria-live="polite">{saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</span>
                    <button type="button" onClick={downloadSource} title="Download Mermaid source" className="rounded-lg border border-[var(--fv-border)] p-2 text-[var(--fv-text-secondary)] transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[#7068FF]"><FileCode2 size={16} /></button>
                    <button type="button" onClick={downloadSvg} title="Download SVG" className="rounded-lg border border-[var(--fv-border)] p-2 text-[var(--fv-text-secondary)] transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[#7068FF]"><Download size={16} /></button>
                    <button type="button" onClick={deleteDiagram} title="Delete diagram" className="rounded-lg border border-rose-500/25 p-2 text-rose-400 transition hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-rose-400"><Trash2 size={16} /></button>
                    <button type="submit" disabled={!dirty || saving} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--fv-accent)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] disabled:cursor-not-allowed disabled:opacity-40"><Save size={14} /> Save</button>
                  </div>
                </form>

                <div className="flex items-center gap-1 border-b border-[var(--fv-border)] px-4 py-2" role="tablist" aria-label="Diagram editor">
                  <button type="button" role="tab" aria-selected={editorMode === "visual"} onClick={() => setEditorMode("visual")} className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#7068FF] ${editorMode === "visual" ? "bg-[var(--fv-accent-soft)] text-[var(--fv-accent)]" : "text-[var(--fv-text-secondary)] hover:bg-white/[0.04]"}`}>Visual editor</button>
                  <button type="button" role="tab" aria-selected={editorMode === "source"} onClick={() => setEditorMode("source")} className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#7068FF] ${editorMode === "source" ? "bg-[var(--fv-accent-soft)] text-[var(--fv-accent)]" : "text-[var(--fv-text-secondary)] hover:bg-white/[0.04]"}`}>Mermaid source and preview</button>
                  <span className="ml-auto hidden text-xs text-[var(--fv-text-muted)] md:inline">Visual layout and Mermaid source save independently.</span>
                </div>

                <form onSubmit={generateDiagram} className="grid gap-3 border-b border-[var(--fv-border)] bg-[var(--fv-bg)]/60 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-6">
                  <div>
                    <label htmlFor="diagram-prompt" className="mb-1.5 block text-xs font-medium text-[var(--fv-text-secondary)]">Describe the diagram you want</label>
                    <textarea id="diagram-prompt" value={generationPrompt} onChange={(event) => setGenerationPrompt(event.target.value)} maxLength={2000} rows={2} placeholder="Map our onboarding flow from signup through the first project, including the email verification decision." className="min-h-16 w-full resize-y rounded-lg border border-[var(--fv-border)] bg-[var(--fv-surface)] px-3 py-2.5 text-sm leading-5 text-[var(--fv-text)] outline-none placeholder:text-[var(--fv-text-muted)] focus-visible:ring-2 focus-visible:ring-[#7068FF]/40" />
                    <p className="mt-1 text-xs text-[var(--fv-text-muted)]">AI creates editable Mermaid source. Review the preview, then save when it looks right.</p>
                  </div>
                  <button type="submit" disabled={!generationPrompt.trim() || generating || saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--fv-accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--fv-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] disabled:cursor-not-allowed disabled:opacity-45">
                    {generating ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                    {generating ? "Generating…" : "Generate diagram"}
                  </button>
                </form>

                {editorMode === "visual" ? (
                  <DiagramCanvas value={visualData} onChange={(next) => setField(setVisualData, next)} onConvertSource={replaceSourceFromCanvas} />
                ) : <div className="grid flex-1 grid-cols-1 xl:grid-cols-2">
                  <section className="flex min-h-96 min-w-0 flex-col border-b border-[var(--fv-border)] xl:border-b-0 xl:border-r" aria-labelledby="mermaid-source-title">
                    <div className="flex items-center justify-between border-b border-[var(--fv-border)] px-5 py-3">
                      <h2 id="mermaid-source-title" className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fv-text-muted)]">Mermaid source</h2>
                      <span className="text-[11px] tabular-nums text-[var(--fv-text-muted)]">{source.length.toLocaleString()} / 100,000</span>
                    </div>
                    <label htmlFor="diagram-source" className="sr-only">Mermaid diagram source</label>
                    <textarea id="diagram-source" value={source} onChange={(event) => setField(setSource, event.target.value)} maxLength={100000} spellCheck="false" className="min-h-96 flex-1 resize-y bg-[var(--fv-bg)] p-5 font-mono text-sm leading-6 text-[var(--fv-text)] outline-none selection:bg-[#7068FF]/30 placeholder:text-[var(--fv-text-muted)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7068FF]/50" />
                  </section>
                  <section className="flex min-h-96 min-w-0 flex-col" aria-labelledby="diagram-preview-title">
                    <div className="flex items-center justify-between border-b border-[var(--fv-border)] px-5 py-3">
                      <h2 id="diagram-preview-title" className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fv-text-muted)]">Live preview</h2>
                      <span className="text-[11px] text-[var(--fv-text-muted)]">SVG output</span>
                    </div>
                    <div ref={previewRef} className="flex-1 p-4 md:p-5"><MermaidPreview source={source} className="h-full min-h-[420px]" /></div>
                  </section>
                </div>}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
