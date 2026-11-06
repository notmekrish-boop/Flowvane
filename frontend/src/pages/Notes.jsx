import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Search, Pin, Trash2, FolderPlus, StickyNote, Save, Check, Bold, Italic, Heading2, List, ListChecks, Code2, Link2, Table2, GitBranch, Sparkles, LoaderCircle, ListTodo } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import MermaidPreview from "../components/MermaidPreview";
import { API_URL } from "../lib/api.js";


export default function Notes() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectScope = searchParams.get("projectId") || "";
  const taskScope = searchParams.get("taskId") || "";
  const [notes, setNotes] = useState([]);
  const [linkedDiagramState, setLinkedDiagramState] = useState({ noteId: null, diagrams: [] });
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [savedFolders, setSavedFolders] = useState(["General"]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("All notes");
  const [newFolder, setNewFolder] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [saveState, setSaveState] = useState("Saved");
  const [editorMode, setEditorMode] = useState("edit");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [pendingSave, setPendingSave] = useState(null);
  const latestSaveVersion = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const [actionItems, setActionItems] = useState([]);
  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);
  const [actionItemsSaving, setActionItemsSaving] = useState(false);
  const [actionItemsError, setActionItemsError] = useState("");
  const [actionProjectId, setActionProjectId] = useState("");
  const [error, setError] = useState("");
  const selected = notes.find((note) => note.id === selectedId) || null;
  const linkedDiagrams = linkedDiagramState.noteId === selected?.id ? linkedDiagramState.diagrams : [];

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }, [token]);

  const loadNotes = useCallback(async () => {
    try {
      const noteQuery = taskScope
        ? `?taskId=${encodeURIComponent(taskScope)}`
        : projectScope === "personal"
        ? "?scope=personal"
        : projectScope
          ? `?projectId=${encodeURIComponent(projectScope)}`
          : "";
      const [data, folderData, projectData, taskData] = await Promise.all([
        request(`/notes${noteQuery}`),
        request("/notes/folders"),
        request("/projects"),
        request("/tasks")
      ]);
      setNotes(data.notes || []);
      setProjects(projectData.projects || []);
      setTasks(taskData.tasks || []);
      setSavedFolders(["General", ...(folderData.folders || []).map((f) => f.name)]);
      setSelectedId((current) => current && data.notes.some((n) => n.id === current) ? current : data.notes[0]?.id || null);
      setError("");
    } catch (err) { setError(err.message); }
  }, [projectScope, taskScope, request]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    if (!selected?.id || !token) return undefined;
    let active = true;
    request(`/diagrams?noteId=${encodeURIComponent(selected.id)}`)
      .then((data) => { if (active) setLinkedDiagramState({ noteId: selected.id, diagrams: data.diagrams || [] }); })
      .catch(() => { if (active) setLinkedDiagramState({ noteId: selected.id, diagrams: [] }); });
    return () => { active = false; };
  }, [request, selected?.id, token]);

  useEffect(() => {
    setActionItems([]);
    setActionPanelOpen(false);
    setActionItemsError("");
    setActionProjectId(selected?.projectId || "");
  }, [selected?.id, selected?.projectId]);

  const folders = useMemo(() => ["All notes", ...new Set([...savedFolders, ...notes.map((n) => n.folder || "General")])], [notes, savedFolders]);
  const visibleNotes = useMemo(() => notes.filter((n) => (folder === "All notes" || n.folder === folder) && `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase())), [notes, folder, search]);

  async function createNote() {
    try {
      const data = await request("/notes", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled note",
          folder: folder === "All notes" ? "General" : folder,
          projectId: projectScope && projectScope !== "personal" ? projectScope : null,
          ...(taskScope ? { taskId: taskScope } : {})
        })
      });
      setNotes((items) => [data.note, ...items]); setSelectedId(data.note.id); setSaveState("Saved");
    } catch (err) { setError(err.message); }
  }

  async function extractActionItems() {
    if (!selected || actionItemsLoading) return;
    setActionItemsLoading(true);
    setActionPanelOpen(true);
    setActionItemsError("");
    try {
      const data = await request(`/ai/action-items/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({ content: selected.content || "" })
      });
      const items = data.actionItems || [];
      setActionItems(items.map((item) => ({ ...item, selected: true, created: false })));
      if (!items.length) setActionItemsError("No clear follow-up tasks were found in this note.");
    } catch (err) {
      setActionItemsError(err.message || "Unable to extract action items.");
    } finally {
      setActionItemsLoading(false);
    }
  }

  async function createSelectedActionItems() {
    const project = projects.find((item) => item.id === actionProjectId);
    const isAdmin = project && (project.ownerId === user?.id || project.members?.some((member) => member.role === "ADMIN"));
    const selectedItems = actionItems.filter((item) => item.selected && !item.created);
    if (!isAdmin || !selectedItems.length || actionItemsSaving) return;
    setActionItemsSaving(true);
    setActionItemsError("");
    try {
      let createdCount = 0;
      for (const item of selectedItems) {
        await request(`/tasks/projects/${encodeURIComponent(actionProjectId)}/tasks`, {
          method: "POST",
          body: JSON.stringify({ title: item.title, description: item.description, priority: item.priority, dueDate: item.dueDate || null })
        });
        createdCount += 1;
        setActionItems((current) => current.map((candidate) => candidate === item ? { ...candidate, created: true, selected: false } : candidate));
      }
      await loadNotes();
      setActionItemsError(`${createdCount} ${createdCount === 1 ? "task was" : "tasks were"} added to ${project.name}.`);
    } catch (err) {
      setActionItemsError(err.message || "Some tasks could not be created. Created tasks remain in the project.");
    } finally {
      setActionItemsSaving(false);
    }
  }

  function updateLocal(field, value) {
    if (!selected) return;
    const version = ++latestSaveVersion.current;
    setNotes((items) => items.map((n) => n.id === selected.id ? { ...n, [field]: value } : n));
    setSaveState("Saving…");
    setPendingSave((current) => ({
      id: selected.id,
      version,
      changes: {
        ...(current?.id === selected.id ? current.changes : {}),
        [field]: value,
      },
    }));
  }

  useEffect(() => {
    if (!pendingSave) return undefined;
    const timeout = setTimeout(async () => {
      const { id, changes, version } = pendingSave;
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        try {
          const data = await request(`/notes/${id}`, {
            method: "PATCH",
            body: JSON.stringify(changes)
          });
          if (latestSaveVersion.current === version) {
            setNotes((items) => items.map((note) => note.id === id ? { ...note, ...data.note } : note));
            setSaveState("Saved");
            setPendingSave((current) => current?.version === version ? null : current);
          }
        } catch (err) {
          if (latestSaveVersion.current === version) {
            setSaveState("Not saved");
            setError(err.message);
          }
        }
      });
    }, 650);
    return () => clearTimeout(timeout);
  }, [pendingSave, request]);

  function wrapSelection(before, after, placeholder) {
    if (!selected) return;
    const content = selected.content || "";
    const start = Math.min(selection.start, content.length);
    const end = Math.min(Math.max(selection.end, start), content.length);
    const text = content.slice(start, end) || placeholder;
    const next = `${content.slice(0, start)}${before}${text}${after}${content.slice(end)}`;
    updateLocal("content", next);
    setSelection({ start: start + before.length, end: start + before.length + text.length });
    focusTextareaAt(start + before.length, start + before.length + text.length);
  }

  function prefixLines(prefix, placeholder) {
    if (!selected) return;
    const content = selected.content || "";
    const start = Math.min(selection.start, content.length);
    const end = Math.min(Math.max(selection.end, start), content.length);
    const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = content.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
    const lines = content.slice(lineStart, lineEnd) || placeholder;
    const replacement = lines.split("\n").map((line) => `${prefix}${line}`).join("\n");
    const next = `${content.slice(0, lineStart)}${replacement}${content.slice(lineEnd)}`;
    updateLocal("content", next);
    const selectionStart = lineStart + prefix.length;
    setSelection({ start: selectionStart, end: lineStart + replacement.length });
    focusTextareaAt(selectionStart, lineStart + replacement.length);
  }

  function insertTable() {
    if (!selected) return;
    const content = selected.content || "";
    const start = Math.min(selection.start, content.length);
    const end = Math.min(Math.max(selection.end, start), content.length);
    const table = "| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |";
    const spacer = start > 0 && content[start - 1] !== "\n" ? "\n" : "";
    const next = `${content.slice(0, start)}${spacer}${table}${content.slice(end)}`;
    updateLocal("content", next);
    const cursor = start + spacer.length + table.length;
    setSelection({ start: cursor, end: cursor });
    focusTextareaAt(cursor, cursor);
  }

  function focusTextareaAt(start, end) {
    requestAnimationFrame(() => {
      const textarea = document.getElementById("note-content");
      textarea?.focus();
      textarea?.setSelectionRange(start, end);
    });
  }

  async function togglePin(note) {
    try { const data = await request(`/notes/${note.id}`, { method: "PATCH", body: JSON.stringify({ isPinned: !note.isPinned }) }); setNotes((items) => items.map((n) => n.id === note.id ? data.note : n)); }
    catch (err) { setError(err.message); }
  }

  async function deleteNote(note) {
    if (!window.confirm(`Delete “${note.title || "Untitled note"}”?`)) return;
    try { await request(`/notes/${note.id}`, { method: "DELETE" }); const remaining = notes.filter((n) => n.id !== note.id); setNotes(remaining); if (selectedId === note.id) setSelectedId(remaining[0]?.id || null); }
    catch (err) { setError(err.message); }
  }

  function addFolder(e) {
    e.preventDefault(); const value = newFolder.trim();
    if (!value) return;
    request("/notes/folders", { method: "POST", body: JSON.stringify({ name: value }) })
      .then(() => { setSavedFolders((items) => [...new Set([...items, value])]); setFolder(value); setNewFolder(""); setShowFolderInput(false); })
      .catch((err) => setError(err.message));
  }

  function changeProjectScope(value) {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set("projectId", value);
    else nextParams.delete("projectId");
    nextParams.delete("taskId");
    setFolder("All notes");
    setSearchParams(nextParams);
  }

  function changeTaskScope(value) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("projectId");
    if (value) nextParams.set("taskId", value);
    else nextParams.delete("taskId");
    setFolder("All notes");
    setSearchParams(nextParams);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-80px)] max-w-[1600px] space-y-5 p-5 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7068FF]">Workspace</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">Notes</h1>
          <p className="mt-1 text-sm text-slate-500">Capture ideas and keep your project knowledge close.</p>
        </div>
        <button type="button" onClick={createNote} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#7068FF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5f56eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF]">
          <Plus size={18} aria-hidden="true" /> New note
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid min-h-[min(700px,calc(100vh-210px))] grid-cols-1 gap-4 xl:grid-cols-[210px_290px_minmax(0,1fr)]">
        <aside aria-label="Note folders" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between px-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Folders</h2>
            <span className="text-xs tabular-nums text-slate-400">{folders.length - 1}</span>
          </div>
          {folders.map((item) => (
            <button key={item} type="button" onClick={() => setFolder(item)} aria-current={folder === item ? "page" : undefined}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] ${folder === item ? "bg-[#7068FF]/10 font-semibold text-[#6258E8]" : "text-slate-600 hover:bg-slate-50"}`}>
              <StickyNote size={16} aria-hidden="true" /> <span className="truncate">{item}</span>
            </button>
          ))}
          <div className="border-t border-slate-100 pt-3">
            {showFolderInput ? (
              <form onSubmit={addFolder} className="flex gap-2">
                <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name…" aria-label="New folder name" className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-[#7068FF]" />
                <button type="submit" className="rounded-lg px-2 text-sm font-semibold text-[#6258E8] hover:bg-[#7068FF]/10">Add</button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowFolderInput(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#6258E8]">
                <FolderPlus size={16} aria-hidden="true" /> New folder
              </button>
            )}
          </div>
        </aside>

        <section aria-label="Notes list" className="flex min-h-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search size={16} aria-hidden="true" className="absolute left-3 top-2.5 text-slate-400" />
              <input type="search" name="note-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" aria-label="Search notes" className="w-full rounded-xl bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-[#7068FF]/40" />
            </div>
            <label htmlFor="notes-project-filter" className="mt-3 block text-xs font-medium text-slate-500">Project</label>
            <select
              id="notes-project-filter"
              value={projectScope}
              onChange={(event) => changeProjectScope(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-[#7068FF]"
            >
              <option value="">All notes</option>
              <option value="personal">Personal notes</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <label htmlFor="notes-task-filter" className="mt-3 block text-xs font-medium text-slate-500">Task</label>
            <select
              id="notes-task-filter"
              value={taskScope}
              onChange={(event) => changeTaskScope(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-[#7068FF]"
            >
              <option value="">All tasks</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {task.project?.name}</option>)}
            </select>
            <p className="mt-2 px-1 text-xs text-slate-400">{visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visibleNotes.length ? visibleNotes.map((note) => (
              <button key={note.id} type="button" onClick={() => setSelectedId(note.id)} aria-current={selectedId === note.id ? "true" : undefined}
                className={`w-full border-b border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#7068FF] ${selectedId === note.id ? "border-l-[3px] border-l-[#7068FF] bg-[#7068FF]/[0.06]" : ""}`}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex-1 truncate text-sm font-semibold text-slate-800">{note.title || "Untitled note"}</span>
                  {note.isPinned && <Pin size={13} aria-label="Pinned" className="shrink-0 text-[#6258E8]" />}
                </div>
                <p className="mt-1 line-clamp-2 break-words text-xs text-slate-500">{note.content || "No additional text"}</p>
                <p className="mt-2 text-[11px] text-slate-400">{new Date(note.updatedAt).toLocaleDateString("en-IN")} · {note.folder} · {note.task?.title || note.project?.name || "Personal"}</p>
              </button>
            )) : <div className="p-8 text-center text-sm text-slate-400">No notes here yet.</div>}
          </div>
        </section>

        <section aria-label="Note editor" className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          {selected ? <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-xs text-slate-400" role="status" aria-live="polite">
                <Save size={14} aria-hidden="true" />
                {saveState === "Saved" ? <><Check size={13} className="text-green-500" aria-hidden="true" />Saved</> : saveState}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={extractActionItems} disabled={actionItemsLoading || !selected.content?.trim()} title="Extract action items" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#6258E8] transition-colors hover:bg-[#7068FF]/10 focus-visible:outline-2 focus-visible:outline-[#7068FF] disabled:cursor-not-allowed disabled:opacity-40">
                  {actionItemsLoading ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
                  <span>{actionItemsLoading ? "Extracting…" : "Extract actions"}</span>
                </button>
                <button type="button" onClick={() => togglePin(selected)} title={selected.isPinned ? "Unpin note" : "Pin note"} aria-label={selected.isPinned ? "Unpin note" : "Pin note"} className={`rounded-lg p-2 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#7068FF] ${selected.isPinned ? "text-[#6258E8]" : "text-slate-500"}`}><Pin size={17} aria-hidden="true" /></button>
                <button type="button" onClick={() => deleteNote(selected)} title="Delete note" aria-label={`Delete ${selected.title || "Untitled note"}`} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"><Trash2 size={17} aria-hidden="true" /></button>
              </div>
            </div>
            <input value={selected.title} onChange={(e) => updateLocal("title", e.target.value)} placeholder="Untitled note" aria-label="Note title" className="bg-transparent py-5 text-2xl font-bold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7068FF]/40" />
            <div className="mb-4 flex items-center gap-2">
              <label htmlFor="note-folder" className="text-xs text-slate-400">Folder</label>
              <select id="note-folder" value={selected.folder} onChange={(e) => updateLocal("folder", e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 focus-visible:outline-2 focus-visible:outline-[#7068FF]">
                {[...new Set([...folders.filter((f) => f !== "All notes"), selected.folder])].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label htmlFor="note-project" className="text-xs text-slate-400">Project</label>
              <select
                id="note-project"
                value={selected.projectId || ""}
                onChange={(e) => updateLocal("projectId", e.target.value || null)}
                className="max-w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 focus-visible:outline-2 focus-visible:outline-[#7068FF]"
              >
                <option value="">Personal note</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <span className="text-xs text-slate-400">Only you can read your notes and linked diagrams.</span>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label htmlFor="note-task" className="text-xs text-slate-400">Linked task</label>
              <select
                id="note-task"
                value={selected.taskId || ""}
                onChange={(event) => updateLocal("taskId", event.target.value || null)}
                className="max-w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 focus-visible:outline-2 focus-visible:outline-[#7068FF]"
              >
                <option value="">No linked task</option>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {task.project?.name}</option>)}
              </select>
              {selected.task && <span className="text-xs text-slate-400">Task association keeps the note in {selected.task.project?.name || "the task project"}.</span>}
            </div>
            {actionPanelOpen && (
              <section aria-labelledby="note-action-items-title" className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 id="note-action-items-title" className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ListTodo size={16} className="text-[#6258E8]" aria-hidden="true" />Suggested action items</h2>
                    <p className="mt-1 text-xs text-slate-500">Review the suggestions and choose which ones to add as tasks.</p>
                  </div>
                  <label className="text-xs font-medium text-slate-500">
                    Add to project
                    <select value={actionProjectId} onChange={(event) => setActionProjectId(event.target.value)} className="ml-2 min-h-9 max-w-56 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus-visible:outline-2 focus-visible:outline-[#7068FF]">
                      <option value="">Choose project</option>
                      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select>
                  </label>
                </div>
                {actionItemsError && <p role="status" className="mt-3 text-xs text-slate-600">{actionItemsError}</p>}
                <ul className="mt-3 divide-y divide-slate-200">
                  {actionItems.map((item, index) => (
                    <li key={`${item.title}-${index}`} className="flex items-start gap-3 py-3">
                      <input type="checkbox" checked={item.selected} disabled={item.created || actionItemsSaving} onChange={(event) => setActionItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, selected: event.target.checked } : candidate))} aria-label={`Add ${item.title} as a task`} className="mt-1 h-4 w-4 rounded accent-[#7068FF]" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${item.created ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.title}{item.created && <span className="ml-2 text-xs font-normal no-underline">Added</span>}</p>
                        {item.description && <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>}
                        <p className="mt-1 text-[11px] text-slate-400">{item.priority} priority{item.dueDate ? ` · Due ${item.dueDate}` : ""}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                  <p className="text-xs text-slate-500">Tasks are created only after you select them and confirm below.</p>
                  <button type="button" onClick={createSelectedActionItems} disabled={actionItemsSaving || !actionItems.some((item) => item.selected && !item.created) || !projects.some((project) => project.id === actionProjectId && (project.ownerId === user?.id || project.members?.some((member) => member.role === "ADMIN")))} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#7068FF] px-3 text-xs font-semibold text-white transition hover:bg-[#5f56eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] disabled:cursor-not-allowed disabled:opacity-45">
                    {actionItemsSaving ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                    {actionItemsSaving ? "Adding tasks…" : "Create selected tasks"}
                  </button>
                </div>
                {actionProjectId && !projects.some((project) => project.id === actionProjectId && (project.ownerId === user?.id || project.members?.some((member) => member.role === "ADMIN"))) && <p className="mt-2 text-right text-xs text-amber-700">Only project owners and admins can create tasks.</p>}
              </section>
            )}
            <div className="notes-linked-diagrams mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"><GitBranch size={15} aria-hidden="true" /> {linkedDiagrams.length} linked {linkedDiagrams.length === 1 ? "diagram" : "diagrams"}</span>
              <button type="button" onClick={() => navigate(`/diagrams?noteId=${encodeURIComponent(selected.id)}`)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[#6258E8] transition hover:bg-[#7068FF]/10 focus-visible:outline-2 focus-visible:outline-[#7068FF]">
                <Plus size={14} aria-hidden="true" /> {linkedDiagrams.length ? "Manage diagrams" : "Insert diagram"}
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div role="group" aria-label="Note content view" className="inline-flex rounded-lg bg-slate-100 p-1">
                {[{ id: "edit", label: "Edit" }, { id: "preview", label: "Preview" }].map((mode) => (
                  <button
                    key={mode.id}
                    id={`note-${mode.id}-tab`}
                    type="button"
                    aria-pressed={editorMode === mode.id}
                    aria-controls={`note-${mode.id}-panel`}
                    onClick={() => setEditorMode(mode.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#7068FF] ${editorMode === mode.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">Markdown supported</p>
            </div>
            {editorMode === "edit" ? (
              <div id="note-edit-panel" className="flex flex-1 flex-col">
                <div role="group" aria-label="Markdown formatting" className="mb-2 flex flex-wrap items-center gap-1">
                  {[
                    { label: "Heading", icon: Heading2, action: () => prefixLines("## ", "Heading") },
                    { label: "Bold", icon: Bold, action: () => wrapSelection("**", "**", "bold text") },
                    { label: "Italic", icon: Italic, action: () => wrapSelection("*", "*", "italic text") },
                    { label: "Bullet list", icon: List, action: () => prefixLines("- ", "List item") },
                    { label: "Checklist", icon: ListChecks, action: () => prefixLines("- [ ] ", "Task") },
                    { label: "Inline code", icon: Code2, action: () => wrapSelection("`", "`", "code") },
                    { label: "Link", icon: Link2, action: () => wrapSelection("[", "](url)", "link text") },
                    { label: "Insert table", icon: Table2, action: insertTable }
                  ].map(({ label, icon: Icon, action }) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      aria-label={label}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={action}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-[#7068FF]"
                    >
                      <Icon size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <textarea
                  id="note-content"
                  value={selected.content}
                  onChange={(e) => {
                    updateLocal("content", e.target.value);
                    setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd });
                  }}
                  onSelect={(e) => setSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
                  placeholder="Start writing… Changes save automatically."
                  aria-label="Note content in Markdown"
                  spellCheck
                  className="min-h-[300px] flex-1 resize-y rounded-xl border border-slate-100 bg-slate-50/70 p-4 font-mono text-sm leading-7 text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7068FF]/30 dark:bg-[#101116] dark:text-[#C6C6D0] dark:placeholder:text-[#777984]"
                />
              </div>
            ) : (
              <div id="note-preview-panel" className="min-h-[350px] flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-4 md:p-5 dark:bg-[#111217]">
                {selected.content.trim() ? (
                  <div className="prose prose-sm max-w-none break-words prose-headings:font-semibold prose-headings:text-slate-800 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-800 prose-code:rounded prose-code:bg-slate-200 prose-code:px-1 prose-code:py-0.5 prose-code:text-[#6258E8] prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:p-4 prose-pre:text-white">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left">{children}</table></div>,
                        th: ({ children }) => <th className="border border-slate-200 bg-slate-100 px-3 py-2 font-semibold">{children}</th>,
                        td: ({ children }) => <td className="border border-slate-200 px-3 py-2">{children}</td>
                      }}
                    >
                      {selected.content}
                    </ReactMarkdown>
                  </div>
                ) : <p className="text-sm text-slate-400">Your Markdown preview will appear here as you write.</p>}
              </div>
            )}
            {linkedDiagrams.length > 0 && (
              <section aria-label="Diagrams linked to this note" className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                {linkedDiagrams.map((diagram) => (
                  <article key={diagram.id} className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h2 className="truncate text-sm font-semibold text-slate-700">{diagram.title}</h2>
                      <button type="button" onClick={() => navigate(`/diagrams?noteId=${encodeURIComponent(selected.id)}`)} className="shrink-0 text-xs font-medium text-[#6258E8] hover:underline focus-visible:outline-2 focus-visible:outline-[#7068FF]">Edit</button>
                    </div>
                    <MermaidPreview source={diagram.source} className="min-h-44" />
                  </article>
                ))}
              </section>
            )}
          </> : (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-slate-400">
              <StickyNote size={36} aria-hidden="true" className="mb-3" />
              <p className="font-medium">Select a note or create one</p>
              <p className="mt-1 text-sm">Your notes are private to your account.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
