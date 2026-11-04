import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Pin, Trash2, FolderPlus, StickyNote, Save, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

export default function Notes() {
  const { token } = useAuth();
  const [notes, setNotes] = useState([]);
  const [savedFolders, setSavedFolders] = useState(["General"]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("All notes");
  const [newFolder, setNewFolder] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [saveState, setSaveState] = useState("Saved");
  const [error, setError] = useState("");
  const timer = useRef(null);
  const selected = notes.find((note) => note.id === selectedId) || null;

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }, [token]);

  const loadNotes = useCallback(async () => {
    try {
      const [data, folderData] = await Promise.all([request("/notes"), request("/notes/folders")]);
      setNotes(data.notes || []);
      setSavedFolders(["General", ...(folderData.folders || []).map((f) => f.name)]);
      setSelectedId((current) => current && data.notes.some((n) => n.id === current) ? current : data.notes[0]?.id || null);
      setError("");
    } catch (err) { setError(err.message); }
  }, [request]);

  useEffect(() => { loadNotes(); }, [loadNotes]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const folders = useMemo(() => ["All notes", ...new Set([...savedFolders, ...notes.map((n) => n.folder || "General")])], [notes, savedFolders]);
  const visibleNotes = useMemo(() => notes.filter((n) => (folder === "All notes" || n.folder === folder) && `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase())), [notes, folder, search]);

  async function createNote() {
    try {
      const data = await request("/notes", { method: "POST", body: JSON.stringify({ title: "Untitled note", folder: folder === "All notes" ? "General" : folder }) });
      setNotes((items) => [data.note, ...items]); setSelectedId(data.note.id); setSaveState("Saved");
    } catch (err) { setError(err.message); }
  }

  function updateLocal(field, value) {
    if (!selected) return;
    setNotes((items) => items.map((n) => n.id === selected.id ? { ...n, [field]: value } : n));
    setSaveState("Saving…");
    clearTimeout(timer.current);
    const id = selected.id;
    timer.current = setTimeout(async () => {
      try {
        await request(`/notes/${id}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
        setSaveState("Saved");
      } catch (err) { setSaveState("Not saved"); setError(err.message); }
    }, 650);
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

  return (
    <main className="p-6 lg:p-8 space-y-5 min-h-[calc(100vh-80px)]">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-800">My Notes</h1><p className="text-sm text-slate-500 mt-1">Capture ideas and keep project knowledge in one place.</p></div><button onClick={createNote} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5"><Plus size={18}/>New note</button></div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-[230px_310px_minmax(0,1fr)] gap-4 min-h-[650px]">
        <aside className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2"><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-2 mb-3">Folders</h2>{folders.map((item) => <button key={item} onClick={() => setFolder(item)} className={`w-full flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm ${folder === item ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}><StickyNote size={16}/>{item}</button>)}<div className="pt-3 border-t border-slate-100">{showFolderInput ? <form onSubmit={addFolder} className="flex gap-1"><input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" className="min-w-0 w-full border rounded-lg px-2 py-1.5 text-sm"/><button className="text-blue-600 text-sm">Add</button></form> : <button onClick={() => setShowFolderInput(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-blue-600"><FolderPlus size={16}/>New folder</button>}</div></aside>
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col"><div className="p-3 border-b border-slate-100"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..." className="w-full bg-slate-50 rounded-lg py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div></div><div className="overflow-y-auto flex-1">{visibleNotes.length ? visibleNotes.map((note) => <button key={note.id} onClick={() => setSelectedId(note.id)} className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 ${selectedId === note.id ? "bg-blue-50/70 border-l-4 border-l-blue-600" : ""}`}><div className="flex items-center gap-2"><span className="font-semibold text-sm text-slate-800 truncate flex-1">{note.title || "Untitled note"}</span>{note.isPinned && <Pin size={13} className="text-blue-600"/>}</div><p className="text-xs text-slate-500 mt-1 line-clamp-2">{note.content || "No additional text"}</p><p className="text-[11px] text-slate-400 mt-2">{new Date(note.updatedAt).toLocaleDateString("en-IN")} · {note.folder}</p></button>) : <div className="p-8 text-center text-sm text-slate-400">No notes here yet.</div>}</div></section>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col min-h-[500px]">{selected ? <><div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><div className="flex items-center gap-2 text-xs text-slate-400"><Save size={14}/>{saveState === "Saved" ? <><Check size={13} className="text-green-500"/>Saved</> : saveState}</div><div className="flex gap-2"><button onClick={() => togglePin(selected)} title={selected.isPinned ? "Unpin note" : "Pin note"} className={`p-2 rounded-lg hover:bg-slate-100 ${selected.isPinned ? "text-blue-600" : "text-slate-500"}`}><Pin size={17}/></button><button onClick={() => deleteNote(selected)} title="Delete note" className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"><Trash2 size={17}/></button></div></div><input value={selected.title} onChange={(e) => updateLocal("title", e.target.value)} placeholder="Untitled note" className="text-2xl font-bold text-slate-800 outline-none py-5 bg-transparent"/><div className="flex items-center gap-2 mb-4"><span className="text-xs text-slate-400">Folder</span><select value={selected.folder} onChange={(e) => updateLocal("folder", e.target.value)} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600">{[...new Set([...folders.filter((f) => f !== "All notes"), selected.folder])].map((f) => <option key={f} value={f}>{f}</option>)}</select></div><textarea value={selected.content} onChange={(e) => updateLocal("content", e.target.value)} placeholder="Start writing… Changes save automatically." className="flex-1 min-h-[350px] resize-none outline-none text-sm leading-7 text-slate-700 bg-transparent"/></> : <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400"><StickyNote size={36} className="mb-3"/><p className="font-medium">Select a note or create one</p><p className="text-sm mt-1">Your notes are private to your account.</p></div>}</section>
      </div>
    </main>
  );
}
