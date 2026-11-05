import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { MessageCircle, Pencil, Send, Trash2, X } from "./icons";
import { useAuth } from "../context/AuthContext";
import { API_URL, SOCKET_URL } from "../lib/api.js";

const MAX_MESSAGE_LENGTH = 4000;

function mergeMessage(current, incoming) {
  const next = current.filter((message) => message.id !== incoming.id);
  next.push(incoming);
  next.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
  return next;
}

function formatTime(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
  });
}

export default function ProjectChat({ projectId, canManage = false }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("connecting");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyMessageId, setBusyMessageId] = useState(null);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState([]);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Project chat request failed.");
    return result;
  }, [token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request(`/project-chat/${encodeURIComponent(projectId)}/messages`)
      .then((result) => { if (active) setMessages(result.messages || []); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, request]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token },
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;
    const created = (message) => {
      if (message.projectId === projectId) setMessages((current) => mergeMessage(current, message));
    };
    const updated = (message) => {
      if (message.projectId === projectId) setMessages((current) => mergeMessage(current, message));
    };
    const deleted = ({ id, projectId: deletedProjectId }) => {
      if (deletedProjectId === projectId) setMessages((current) => current.filter((message) => message.id !== id));
    };
    socket.on("connect", () => {
      setConnection("connecting");
      socket.emit("project:join", projectId, (result) => {
        if (result?.success) setConnection("connected");
        else { setConnection("disconnected"); setError(result?.message || "Unable to join project chat."); }
      });
    });
    socket.on("disconnect", () => setConnection("disconnected"));
    socket.on("connect_error", (socketError) => {
      setConnection("disconnected");
      setError(socketError.message || "Live chat connection failed.");
    });
    socket.on("project:message-created", created);
    socket.on("project:message-updated", updated);
    socket.on("project:message-deleted", deleted);
    const onTyping = (event) => {
      if (event.scope !== "project" || event.scopeId !== projectId) return;
      setTypingUsers((current) => event.isTyping
        ? [...current.filter((item) => item.userId !== event.userId), { userId: event.userId, name: event.name }]
        : current.filter((item) => item.userId !== event.userId));
    };
    socket.on("typing:updated", onTyping);
    socket.connect();
    return () => {
      socket.emit("project:leave", projectId);
      socket.off("project:message-created", created);
      socket.off("project:message-updated", updated);
      socket.off("project:message-deleted", deleted);
      socket.off("typing:updated", onTyping);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      clearTimeout(typingTimerRef.current);
      setTypingUsers([]);
    };
  }, [projectId, token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    try {
      const result = await request(`/project-chat/${encodeURIComponent(projectId)}/messages`, {
        method: "POST", body: JSON.stringify({ content })
      });
      setMessages((current) => mergeMessage(current, result.message));
      setDraft("");
    } catch (sendError) { setError(sendError.message); }
    finally { setSending(false); }
  };

  const updateDraft = (value) => {
    setDraft(value);
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit("project:typing", { projectId, isTyping: Boolean(value.trim()) });
    clearTimeout(typingTimerRef.current);
    if (value.trim()) typingTimerRef.current = setTimeout(() => socket.emit("project:typing", { projectId, isTyping: false }), 1400);
  };

  const saveEdit = async (messageId) => {
    const content = editDraft.trim();
    if (!content || busyMessageId) return;
    setBusyMessageId(messageId);
    setError("");
    try {
      const result = await request(`/project-chat/${encodeURIComponent(projectId)}/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH", body: JSON.stringify({ content })
      });
      setMessages((current) => mergeMessage(current, result.message));
      setEditingId(null);
    } catch (editError) { setError(editError.message); }
    finally { setBusyMessageId(null); }
  };

  const deleteMessage = async (messageId) => {
    if (busyMessageId || !window.confirm("Delete this project message?")) return;
    setBusyMessageId(messageId);
    setError("");
    try {
      await request(`/project-chat/${encodeURIComponent(projectId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
      setMessages((current) => current.filter((message) => message.id !== messageId));
    } catch (deleteError) { setError(deleteError.message); }
    finally { setBusyMessageId(null); }
  };

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="project-chat-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7068FF]/10 text-[#6258E8]"><MessageCircle size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="project-chat-title" className="text-xl font-bold text-slate-800">Project chat</h2>
            <p className="text-sm text-slate-500">Messages are shared with project members.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 text-xs font-medium ${connection === "connected" ? "text-emerald-700" : "text-slate-500"}`}>
          <span className={`h-2 w-2 rounded-full ${connection === "connected" ? "bg-emerald-500" : "bg-slate-300"}`} />
          {connection === "connected" ? "Live" : "Reconnecting"}
        </span>
      </div>

      <div className="mb-4 max-h-[420px] min-h-44 space-y-4 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-4" aria-live="polite" aria-label="Project messages">
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading project messages…</p> : messages.length === 0 ? (
          <div className="py-10 text-center"><MessageCircle size={26} className="mx-auto mb-2 text-slate-300" aria-hidden="true" /><p className="text-sm text-slate-500">No messages yet. Start the conversation.</p></div>
        ) : messages.map((message) => {
          const isOwn = message.authorId === user?.id;
          const isEditing = editingId === message.id;
          return (
            <article key={message.id} className="group flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-xs font-semibold text-violet-700" aria-hidden="true">
                {message.author?.avatarUrl ? <img src={message.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : (message.author?.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-slate-800">{message.author?.name || "Project member"}</span>
                  <time className="text-xs text-slate-400" dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                  {message.editedAt && <span className="text-xs text-slate-400">edited</span>}
                  {(isOwn || canManage) && !isEditing && <div className="ml-auto flex items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" onClick={() => { setEditingId(message.id); setEditDraft(message.content); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-[#7068FF]" aria-label="Edit message"><Pencil size={14} /></button>
                    <button type="button" onClick={() => deleteMessage(message.id)} disabled={busyMessageId === message.id} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500" aria-label="Delete message"><Trash2 size={14} /></button>
                  </div>}
                </div>
                {isEditing ? <div className="space-y-2">
                  <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} rows={3} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#7068FF] focus:outline-none focus:ring-2 focus:ring-[#7068FF]/20" aria-label="Edit message text" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white"><X size={14} />Cancel</button>
                    <button type="button" disabled={!editDraft.trim() || busyMessageId === message.id} onClick={() => saveEdit(message.id)} className="rounded-lg bg-[#7068FF] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save</button>
                  </div>
                </div> : <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message.content}</p>}
              </div>
            </article>
          );
        })}
        {typingUsers.length > 0 && <p className="pl-12 text-xs text-slate-400">{typingUsers.map((item) => item.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mb-3 text-sm text-red-600" role="alert">{error}</p>}
      <form onSubmit={sendMessage} className="flex items-end gap-3">
        <label className="sr-only" htmlFor="project-chat-composer">Write a project message</label>
        <textarea id="project-chat-composer" value={draft} onChange={(event) => updateDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} rows={2} placeholder="Write a message…" className="min-h-12 flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#7068FF] focus:outline-none focus:ring-2 focus:ring-[#7068FF]/20" />
        <button type="submit" disabled={!draft.trim() || sending} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#7068FF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6258E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7068FF] disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={16} aria-hidden="true" /> <span className="hidden sm:inline">{sending ? "Sending…" : "Send"}</span>
        </button>
      </form>
      <p className="mt-2 text-right text-xs text-slate-400">{draft.length}/{MAX_MESSAGE_LENGTH}</p>
    </section>
  );
}
