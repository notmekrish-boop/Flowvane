import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowLeftRight, CircleHelp, Minus, Plus, Redo2, Trash2, Undo2 } from "./icons";

const WIDTH = 1800;
const HEIGHT = 1100;
const COLORS = ["#7068ff", "#328d83", "#ce8e3d", "#b55b79", "#4f82bd", "#6f7b8f"];

export const EMPTY_VISUAL_DATA = { nodes: [], edges: [] };

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clone(value) {
  return structuredClone(value || EMPTY_VISUAL_DATA);
}

export default function DiagramCanvas({ value, onChange, onConvertSource }) {
  const data = value || EMPTY_VISUAL_DATA;
  const canvasRef = useRef(null);
  const currentRef = useRef(data);
  currentRef.current = data;
  const dragRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectStart, setConnectStart] = useState(null);
  const [zoom, setZoom] = useState(1);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const selected = data.nodes.find((node) => node.id === selectedId) || null;

  const commit = useCallback((next, record = true) => {
    if (record) {
      pastRef.current = [...pastRef.current.slice(-49), clone(currentRef.current)];
      futureRef.current = [];
    }
    currentRef.current = next;
    onChange(next);
  }, [onChange]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current = [...futureRef.current, clone(currentRef.current)];
    currentRef.current = previous;
    onChange(previous);
  }, [onChange]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current = [...pastRef.current, clone(currentRef.current)];
    currentRef.current = next;
    onChange(next);
  }, [onChange]);

  const addNode = useCallback(() => {
    const index = data.nodes.length;
    const node = {
      id: makeId("node"),
      label: `Step ${index + 1}`,
      details: "",
      color: COLORS[index % COLORS.length],
      x: 180 + (index % 4) * 340,
      y: 150 + Math.floor(index / 4) * 230,
      width: 220,
      height: 128
    };
    commit({ ...clone(data), nodes: [...data.nodes, node] });
    setSelectedId(node.id);
  }, [commit, data]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    commit({
      nodes: data.nodes.filter((node) => node.id !== selected.id),
      edges: data.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id)
    });
    setSelectedId(null);
  }, [commit, data, selected]);

  function startDrag(event, node, kind) {
    if (event.button !== 0 || connectMode) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(node.id);
    pastRef.current = [...pastRef.current.slice(-49), clone(currentRef.current)];
    futureRef.current = [];
    dragRef.current = {
      kind,
      id: node.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    };
    window.addEventListener("pointermove", movePointer);
    window.addEventListener("pointerup", endPointer, { once: true });
  }

  function movePointer(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.pointerX) / zoom;
    const dy = (event.clientY - drag.pointerY) / zoom;
    const nodes = currentRef.current.nodes.map((node) => {
      if (node.id !== drag.id) return node;
      return drag.kind === "resize"
        ? { ...node, width: Math.max(150, Math.min(600, drag.width + dx)), height: Math.max(88, Math.min(420, drag.height + dy)) }
        : { ...node, x: Math.max(0, drag.x + dx), y: Math.max(0, drag.y + dy) };
    });
    commit({ ...clone(currentRef.current), nodes }, false);
  }

  function endPointer() {
    window.removeEventListener("pointermove", movePointer);
    dragRef.current = null;
  }

  function handleNodeClick(node) {
    setSelectedId(node.id);
    if (!connectMode) return;
    if (!connectStart) {
      setConnectStart(node.id);
      return;
    }
    if (connectStart !== node.id && !data.edges.some((edge) => edge.source === connectStart && edge.target === node.id)) {
      commit({ ...clone(data), edges: [...data.edges, { id: makeId("edge"), source: connectStart, target: node.id }] });
    }
    setConnectStart(null);
  }

  function updateSelected(field, fieldValue) {
    if (!selected) return;
    commit({ ...clone(data), nodes: data.nodes.map((node) => node.id === selected.id ? { ...node, [field]: fieldValue } : node) });
  }

  const edgePaths = useMemo(() => data.edges.map((edge) => {
    const from = data.nodes.find((node) => node.id === edge.source);
    const to = data.nodes.find((node) => node.id === edge.target);
    if (!from || !to) return null;
    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = to.x;
    const y2 = to.y + to.height / 2;
    const bend = Math.max(50, Math.abs(x2 - x1) / 2);
    return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`} fill="none" stroke="var(--fv-text-muted)" strokeWidth="2" markerEnd="url(#diagram-arrow)" />;
  }), [data]);

  return (
    <div className="grid min-h-[540px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--fv-border)] px-4 py-3">
          <button type="button" onClick={addNode} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--fv-accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--fv-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF]"><Plus size={15} /> Add node</button>
          <button type="button" onClick={() => { setConnectMode((active) => !active); setConnectStart(null); }} aria-pressed={connectMode} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#7068FF] ${connectMode ? "border-[var(--fv-accent)] bg-[var(--fv-accent-soft)] text-[var(--fv-accent)]" : "border-[var(--fv-border)] text-[var(--fv-text-secondary)] hover:bg-white/[0.04]"}`}><ArrowLeftRight size={15} /> {connectMode ? "Connecting…" : "Connect nodes"}</button>
          <span className="mx-1 h-5 w-px bg-[var(--fv-border)]" aria-hidden="true" />
          <button type="button" onClick={undo} disabled={!pastRef.current.length} aria-label="Undo" title="Undo" className="rounded-lg border border-[var(--fv-border)] p-2 text-[var(--fv-text-secondary)] hover:bg-white/[0.04] disabled:opacity-40"><Undo2 size={15} /></button>
          <button type="button" onClick={redo} disabled={!futureRef.current.length} aria-label="Redo" title="Redo" className="rounded-lg border border-[var(--fv-border)] p-2 text-[var(--fv-text-secondary)] hover:bg-white/[0.04] disabled:opacity-40"><Redo2 size={15} /></button>
          <button type="button" onClick={() => onConvertSource(data)} className="ml-1 min-h-9 rounded-lg border border-[var(--fv-border)] px-3 text-xs font-medium text-[var(--fv-text-secondary)] hover:bg-white/[0.04]">Replace Mermaid source</button>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-[var(--fv-border)] p-1">
            <button type="button" onClick={() => setZoom((current) => Math.max(0.4, Math.round((current - 0.1) * 10) / 10))} aria-label="Zoom out" className="rounded p-1.5 text-[var(--fv-text-secondary)] hover:bg-white/[0.05]"><Minus size={15} /></button>
            <span className="w-12 text-center text-xs tabular-nums text-[var(--fv-text-muted)]">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((current) => Math.min(1.6, Math.round((current + 0.1) * 10) / 10))} aria-label="Zoom in" className="rounded p-1.5 text-[var(--fv-text-secondary)] hover:bg-white/[0.05]"><Plus size={15} /></button>
          </div>
        </div>
        {connectMode && <p className="border-b border-[var(--fv-border)] bg-[var(--fv-accent-soft)] px-4 py-2 text-xs text-[var(--fv-text-secondary)]" role="status">{connectStart ? "Choose the destination node." : "Choose a starting node, then a destination."} Click Connect nodes again to cancel.</p>}
        <div ref={canvasRef} className="relative min-h-[510px] flex-1 overflow-auto bg-[var(--fv-bg)]" aria-label="Visual diagram canvas. Scroll to pan around the workspace.">
          <div className="relative" style={{ width: WIDTH * zoom, height: HEIGHT * zoom }}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: WIDTH, height: HEIGHT, transform: `scale(${zoom})`, backgroundImage: "radial-gradient(var(--fv-border) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                <defs><marker id="diagram-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="var(--fv-text-muted)" /></marker></defs>
                {edgePaths}
              </svg>
              {data.nodes.map((node) => {
                const isSelected = node.id === selectedId;
                return (
                  <article key={node.id} onClick={() => handleNodeClick(node)} style={{ left: node.x, top: node.y, width: node.width, height: node.height, borderColor: isSelected ? "var(--fv-accent)" : "var(--fv-border)", boxShadow: isSelected ? "0 0 0 2px var(--fv-accent-glow)" : undefined }} className={`absolute flex flex-col overflow-hidden rounded-xl border bg-[var(--fv-surface)] text-[var(--fv-text)] ${connectMode ? "cursor-crosshair" : ""}`}>
                    <div onPointerDown={(event) => startDrag(event, node, "move")} className="flex min-h-9 cursor-grab items-center gap-2 px-3 active:cursor-grabbing" style={{ backgroundColor: `${node.color}20`, borderBottom: `1px solid ${node.color}55` }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: node.color }} />
                      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fv-text-secondary)]">Node</span>
                      {isSelected && <ArrowDownRight size={13} className="ml-auto text-[var(--fv-text-muted)]" />}
                    </div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); handleNodeClick(node); }} className="flex flex-1 flex-col items-start justify-center px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#7068FF]">
                      <span className="line-clamp-2 w-full break-words text-sm font-semibold leading-5">{node.label || "Untitled node"}</span>
                      {node.details && <span className="mt-1 line-clamp-2 w-full break-words text-xs leading-4 text-[var(--fv-text-secondary)]">{node.details}</span>}
                    </button>
                    <button type="button" aria-label="Resize node" title="Resize node" onPointerDown={(event) => startDrag(event, node, "resize")} className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none"><span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-[var(--fv-text-muted)]" /></button>
                  </article>
                );
              })}
              {data.nodes.length === 0 && <div className="absolute left-1/2 top-[42%] w-80 -translate-x-1/2 -translate-y-1/2 text-center"><span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--fv-accent-soft)] text-[var(--fv-accent)]"><CircleHelp size={19} /></span><h3 className="text-sm font-semibold text-[var(--fv-text)]">Build a visual layout</h3><p className="mt-2 text-xs leading-5 text-[var(--fv-text-secondary)]">Add nodes, then connect them. Your existing Mermaid source remains saved separately.</p><button type="button" onClick={addNode} className="mt-4 min-h-9 rounded-lg bg-[var(--fv-accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--fv-accent-hover)]">Add first node</button></div>}
            </div>
          </div>
        </div>
      </div>
      <aside className="border-t border-[var(--fv-border)] bg-[var(--fv-surface)] p-4 xl:border-l xl:border-t-0">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-[var(--fv-text)]">Node details</h3><p className="mt-1 text-xs leading-5 text-[var(--fv-text-muted)]">Select a node to edit its content.</p></div>{selected && <button type="button" onClick={deleteSelected} aria-label="Delete selected node" title="Delete node" className="rounded-lg border border-rose-500/25 p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 size={15} /></button>}</div>
        {selected ? <div className="mt-5 space-y-4">
          <label className="block text-xs font-medium text-[var(--fv-text-secondary)]">Label<input value={selected.label} onChange={(event) => updateSelected("label", event.target.value)} maxLength={300} className="mt-1.5 min-h-10 w-full rounded-lg border border-[var(--fv-border)] bg-[var(--fv-bg)] px-3 text-sm text-[var(--fv-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#7068FF]/40" /></label>
          <label className="block text-xs font-medium text-[var(--fv-text-secondary)]">Description<textarea value={selected.details} onChange={(event) => updateSelected("details", event.target.value)} maxLength={2000} rows={4} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--fv-border)] bg-[var(--fv-bg)] px-3 py-2 text-sm leading-5 text-[var(--fv-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#7068FF]/40" /></label>
          <fieldset><legend className="text-xs font-medium text-[var(--fv-text-secondary)]">Color</legend><div className="mt-2 flex flex-wrap gap-2">{COLORS.map((color) => <button key={color} type="button" onClick={() => updateSelected("color", color)} aria-label={`Set node color ${color}`} aria-pressed={selected.color === color} className="h-7 w-7 rounded-full border-2 border-[var(--fv-surface)] outline outline-1 outline-transparent aria-pressed:outline-[var(--fv-text)]" style={{ backgroundColor: color }} />)}</div></fieldset>
          <button type="button" onClick={deleteSelected} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--fv-border)] px-3 text-xs font-medium text-[var(--fv-text-secondary)] hover:border-rose-500/40 hover:text-rose-400"><Trash2 size={14} /> Delete node</button>
        </div> : <div className="mt-5 rounded-lg border border-[var(--fv-border)] px-3 py-4 text-xs leading-5 text-[var(--fv-text-muted)]">Choose a node on the canvas. Drag its header to move it, and use the corner handle to resize.</div>}
        <p className="mt-6 border-t border-[var(--fv-border)] pt-4 text-[11px] leading-5 text-[var(--fv-text-muted)]">Scroll the canvas to pan. Use the zoom controls to change scale. Undo and redo cover canvas edits.</p>
      </aside>
    </div>
  );
}
