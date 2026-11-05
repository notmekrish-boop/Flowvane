import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, FolderKanban, MessageCircle, Search, Users } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { API_URL } from "../lib/api.js";


function getDestination(result) {
  if (result.type === "project") return `/projects/${encodeURIComponent(result.projectId)}`;
  if (result.type === "direct") return `/messages?conversationId=${encodeURIComponent(result.conversationId)}`;
  return "/chat";
}

function formatTime(value) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function MessageSearch() {
  const { token } = useAuth();
  const { activeWorkspace, activeWorkspaceId, workspaces, selectWorkspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeWorkspaceId || query.trim().length < 2) {
      setResults([]); setLoading(false); setSearched(false); setError("");
      return undefined;
    }
    let active = true;
    setLoading(true); setError("");
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ workspaceId: activeWorkspaceId, q: query.trim() });
        const response = await fetch(`${API_URL}/search/messages?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Message search failed.");
        if (active) { setResults(result.results || []); setSearched(true); }
      } catch (searchError) { if (active) setError(searchError.message); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timeout); };
  }, [activeWorkspaceId, query, token]);

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[#F5F5F8] px-5 py-8 text-[#292936] dark:bg-[#08090C] dark:text-[#C6C6D0] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#92939E]"><Search size={14} />Search</div><h1 className="text-3xl font-semibold tracking-tight">Search messages</h1><p className="mt-2 text-sm text-[#686878] dark:text-[#92939E]">Find messages in general chat, accessible project chats and your direct conversations.</p></header>

        <section className="mb-5 rounded-2xl border border-[#E4E4EC] bg-white p-4 dark:border-[#292A32] dark:bg-[#15161C] sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><label htmlFor="message-search-query" className="text-sm font-medium">Search in workspace</label><select aria-label="Workspace to search" value={activeWorkspaceId || ""} onChange={(event) => selectWorkspace(event.target.value)} className="max-w-full rounded-lg border border-[#E4E4EC] bg-white px-3 py-2 text-sm dark:border-[#34353F] dark:bg-[#101116]">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></div>
          <div className="relative"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#92939E]" /><input id="message-search-query" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder={`Search messages in ${activeWorkspace?.name || "workspace"}…`} className="w-full rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#8980FF] focus:ring-2 focus:ring-[#6258E8]/10 dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0]" /></div>
          <p className="mt-2 text-xs text-[#92939E]">Enter at least 2 characters. Results are limited to messages you can access.</p>
        </section>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {loading ? <div className="rounded-2xl border border-[#E4E4EC] bg-white py-12 text-center text-sm text-[#92939E] dark:border-[#292A32] dark:bg-[#15161C]">Searching…</div> : query.trim().length < 2 ? <div className="rounded-2xl border border-dashed border-[#DADAE4] bg-white px-6 py-14 text-center dark:border-[#34353F] dark:bg-[#15161C]"><Search size={24} className="mx-auto mb-3 text-[#B8B8C4]" /><p className="text-sm text-[#686878] dark:text-[#92939E]">Search across workspace conversations.</p></div> : searched && results.length === 0 ? <div className="rounded-2xl border border-dashed border-[#DADAE4] bg-white px-6 py-14 text-center text-sm text-[#686878] dark:border-[#34353F] dark:bg-[#15161C] dark:text-[#92939E]">No matching messages in {activeWorkspace?.name}.</div> : <div className="space-y-3">{results.map((result) => {
          const Icon = result.type === "project" ? FolderKanban : result.type === "direct" ? Users : MessageCircle;
          const channel = result.type === "project" ? "Project chat" : result.type === "direct" ? "Direct message" : "General chat";
          return <Link key={`${result.type}:${result.id}`} to={getDestination(result)} className="block rounded-2xl border border-[#E4E4EC] bg-white p-4 transition hover:border-[#C9C5FA] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6258E8] dark:border-[#292A32] dark:bg-[#15161C] dark:hover:border-[#6258E8]/50 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#92939E]"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0EFFF] px-2.5 py-1 font-medium text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><Icon size={13} />{channel}</span><span>{result.destination}</span><span className="ml-auto inline-flex items-center gap-1"><Clock3 size={12} />{formatTime(result.createdAt)}</span></div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#444453] dark:text-[#C6C6D0]">{result.content}</p>
            <p className="mt-3 text-xs text-[#92939E]">By {result.author?.name || "Member"}</p>
          </Link>;
        })}</div>}
      </div>
    </main>
  );
}
