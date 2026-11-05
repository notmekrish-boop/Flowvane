import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { MessageCircle, Pencil, Send, Trash2, X } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { API_URL, SOCKET_URL } from "../lib/api.js";

const MAX_MESSAGE_LENGTH = 4000;

function insertMessage(messages, message) {
  const next = messages.filter((item) => item.id !== message.id);
  next.push(message);
  next.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
  return next;
}

export default function WorkspaceChat() {
  const { user, token } = useAuth();
  const { activeWorkspace, workspaces, activeWorkspaceId, selectWorkspace } = useWorkspace();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("connecting");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState(null);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState([]);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Workspace chat request failed.");
    return result;
  }, [token]);

  useEffect(() => {
    if (!activeWorkspaceId) { setMessages([]); setLoading(false); return undefined; }
    let current = true;
    setLoading(true); setError("");
    request(`/workspace-chat/${encodeURIComponent(activeWorkspaceId)}/messages`)
      .then((result) => { if (current) setMessages(result.messages || []); })
      .catch((loadError) => { if (current) setError(loadError.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [activeWorkspaceId, request]);

  useEffect(() => {
    if (!activeWorkspaceId) return undefined;
    const socket = io(SOCKET_URL, { autoConnect: false, auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    const created = (message) => { if (message.workspaceId === activeWorkspaceId) setMessages((current) => insertMessage(current, message)); };
    const updated = (message) => { if (message.workspaceId === activeWorkspaceId) setMessages((current) => insertMessage(current, message)); };
    const deleted = ({ id, workspaceId }) => { if (workspaceId === activeWorkspaceId) setMessages((current) => current.filter((message) => message.id !== id)); };
    socket.on("connect", () => {
      setConnection("connecting");
      socket.emit("workspace:join", activeWorkspaceId, (result) => {
        if (result?.success) setConnection("connected");
        else { setConnection("disconnected"); setError(result?.message || "Unable to join workspace chat."); }
      });
    });
    socket.on("disconnect", () => setConnection("disconnected"));
    socket.on("connect_error", (socketError) => { setConnection("disconnected"); setError(socketError.message || "Live chat connection failed."); });
    socket.on("workspace:message-created", created);
    socket.on("workspace:message-updated", updated);
    socket.on("workspace:message-deleted", deleted);
    const onTyping = (event) => {
      if (event.scope !== "workspace" || event.scopeId !== activeWorkspaceId) return;
      setTypingUsers((current) => event.isTyping
        ? [...current.filter((item) => item.userId !== event.userId), { userId: event.userId, name: event.name }]
        : current.filter((item) => item.userId !== event.userId));
    };
    socket.on("typing:updated", onTyping);
    socket.connect();
    return () => {
      socket.emit("workspace:leave", activeWorkspaceId);
      socket.off("workspace:message-created", created);
      socket.off("workspace:message-updated", updated);
      socket.off("workspace:message-deleted", deleted);
      socket.off("typing:updated", onTyping);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      clearTimeout(typingTimerRef.current);
      setTypingUsers([]);
    };
  }, [activeWorkspaceId, token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    if (!activeWorkspaceId || !draft.trim() || sending) return;
    setSending(true); setError("");
    try {
      const result = await request(`/workspace-chat/${encodeURIComponent(activeWorkspaceId)}/messages`, { method: "POST", body: JSON.stringify({ content: draft.trim() }) });
      setMessages((current) => insertMessage(current, result.message)); setDraft("");
    } catch (sendError) { setError(sendError.message); }
    finally { setSending(false); }
  };

  const updateDraft = (value) => {
    setDraft(value);
    const socket = socketRef.current;
    if (!socket?.connected || !activeWorkspaceId) return;
    socket.emit("workspace:typing", { workspaceId: activeWorkspaceId, isTyping: Boolean(value.trim()) });
    clearTimeout(typingTimerRef.current);
    if (value.trim()) typingTimerRef.current = setTimeout(() => socket.emit("workspace:typing", { workspaceId: activeWorkspaceId, isTyping: false }), 1400);
  };

  const saveEdit = async (messageId) => {
    if (!editDraft.trim() || busyId) return;
    setBusyId(messageId); setError("");
    try {
      const result = await request(`/workspace-chat/${encodeURIComponent(activeWorkspaceId)}/messages/${encodeURIComponent(messageId)}`, { method: "PATCH", body: JSON.stringify({ content: editDraft.trim() }) });
      setMessages((current) => insertMessage(current, result.message)); setEditingId(null);
    } catch (editError) { setError(editError.message); }
    finally { setBusyId(null); }
  };

  const remove = async (messageId) => {
    if (busyId || !window.confirm("Delete this message?")) return;
    setBusyId(messageId); setError("");
    try {
      await request(`/workspace-chat/${encodeURIComponent(activeWorkspaceId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
      setMessages((current) => current.filter((message) => message.id !== messageId));
    } catch (deleteError) { setError(deleteError.message); }
    finally { setBusyId(null); }
  };

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[#F5F5F8] px-5 py-8 text-[#292936] dark:bg-[#08090C] dark:text-[#C6C6D0] sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EFFF] text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><MessageCircle size={20} /></span><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-[#92939E]">General chat</p><h1 className="text-2xl font-semibold tracking-tight">{activeWorkspace?.name || "Choose a workspace"}</h1></div></div>
          <label className="sr-only" htmlFor="chat-workspace-select">Workspace</label>
          <select id="chat-workspace-select" value={activeWorkspaceId || ""} onChange={(event) => selectWorkspace(event.target.value)} className="max-w-full rounded-xl border border-[#E4E4EC] bg-white px-3 py-2.5 text-sm text-[#555565] outline-none focus:border-[#8980FF] dark:border-[#34353F] dark:bg-[#15161C] dark:text-[#C6C6D0]">
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </header>

        {!activeWorkspace ? <section className="rounded-2xl border border-dashed border-[#DADAE4] bg-white p-10 text-center dark:border-[#34353F] dark:bg-[#15161C]"><p className="text-sm text-[#686878] dark:text-[#92939E]">Create or join a workspace to use general chat.</p></section> : <section className="flex min-h-[min(72vh,760px)] flex-col rounded-2xl border border-[#E4E4EC] bg-white p-4 dark:border-[#292A32] dark:bg-[#15161C] sm:p-6">
          <div className="mb-4 flex items-center justify-between border-b border-[#EEEEF2] pb-4 dark:border-[#292A32]"><div><h2 className="font-semibold">Workspace conversation</h2><p className="mt-1 text-xs text-[#92939E]">Visible to members of {activeWorkspace.name}.</p></div><span className={`inline-flex items-center gap-2 text-xs font-medium ${connection === "connected" ? "text-emerald-600 dark:text-emerald-400" : "text-[#92939E]"}`}><span className={`h-2 w-2 rounded-full ${connection === "connected" ? "bg-emerald-500" : "bg-slate-300"}`} />{connection === "connected" ? "Live" : "Reconnecting"}</span></div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3" aria-live="polite" aria-label="Workspace messages">
            {loading ? <p className="py-12 text-center text-sm text-[#92939E]">Loading messages…</p> : messages.length === 0 ? <div className="py-16 text-center"><MessageCircle size={28} className="mx-auto mb-3 text-[#C4C4CF]" /><p className="text-sm text-[#686878] dark:text-[#92939E]">No messages yet. Start the conversation.</p></div> : messages.map((message) => {
              const own = message.authorId === user?.id;
              const editing = editingId === message.id;
              return <article key={message.id} className="group flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F0EFFF] text-xs font-semibold text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]">{message.author?.avatarUrl ? <img src={message.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : (message.author?.name || "?").slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-baseline gap-x-2"><span className="text-sm font-semibold">{message.author?.name || "Member"}</span><time className="text-xs text-[#92939E]" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time>{message.editedAt && <span className="text-xs text-[#92939E]">edited</span>}{own && !editing && <div className="ml-auto flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><button type="button" onClick={() => { setEditingId(message.id); setEditDraft(message.content); }} aria-label="Edit message" className="rounded-md p-1.5 text-[#92939E] hover:bg-[#F5F5F8] hover:text-[#292936] dark:hover:bg-white/5 dark:hover:text-white"><Pencil size={14} /></button><button type="button" onClick={() => remove(message.id)} disabled={busyId === message.id} aria-label="Delete message" className="rounded-md p-1.5 text-[#92939E] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 size={14} /></button></div>}</div>
                  {editing ? <div className="space-y-2"><textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} rows={3} className={`${inputClass} w-full resize-y rounded-lg border border-[#E4E4EC] px-3 py-2 text-sm dark:border-[#34353F]`} /><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[#686878]"><X size={14} />Cancel</button><button type="button" onClick={() => saveEdit(message.id)} disabled={!editDraft.trim() || busyId === message.id} className="rounded-lg bg-[#6258E8] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save</button></div></div> : <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#555565] dark:text-[#C6C6D0]">{message.content}</p>}
                </div>
              </article>;
            })}
            {typingUsers.length > 0 && <p className="pl-12 text-xs text-[#92939E]">{typingUsers.map((item) => item.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…</p>}
            <div ref={bottomRef} />
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <form onSubmit={send} className="mt-4 flex items-end gap-3 border-t border-[#EEEEF2] pt-4 dark:border-[#292A32]"><label className="sr-only" htmlFor="workspace-chat-composer">Write a message</label><textarea id="workspace-chat-composer" value={draft} onChange={(event) => updateDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} rows={2} placeholder="Message workspace members…" className="min-h-12 flex-1 resize-y rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] px-3.5 py-3 text-sm text-[#292936] outline-none focus:border-[#8980FF] focus:ring-2 focus:ring-[#6258E8]/10 dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0]" /><button type="submit" disabled={!draft.trim() || sending} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#6258E8] px-4 text-sm font-semibold text-white hover:bg-[#554BD8] disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} /><span className="hidden sm:inline">{sending ? "Sending…" : "Send"}</span></button></form>
          <p className="mt-2 text-right text-xs text-[#92939E]">{draft.length}/{MAX_MESSAGE_LENGTH}</p>
        </section>}
      </div>
    </main>
  );
}

const inputClass = "rounded-xl border bg-[#FAFAFC] text-[#292936] outline-none focus:border-[#8980FF] focus:ring-2 focus:ring-[#6258E8]/10 dark:bg-[#101116] dark:text-[#C6C6D0]";
