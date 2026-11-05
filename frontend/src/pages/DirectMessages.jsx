import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Loader2, MessageCircle, Pencil, Plus, Search, Send, Trash2, UserRound, X } from "../components/icons";
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

function formatTime(value) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function DirectMessages() {
  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversationId");
  const { user, token } = useAuth();
  const { activeWorkspace, activeWorkspaceId, workspaces, selectWorkspace } = useWorkspace();
  const [people, setPeople] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("connecting");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState(null);
  const bottomRef = useRef(null);
  const directSocketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const [presence, setPresence] = useState({});
  const [typingUser, setTypingUser] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Direct message request failed.");
    return result;
  }, [token]);

  const loadConversations = useCallback(async (preferId = null) => {
    if (!activeWorkspaceId) { setPeople([]); setConversations([]); setConversationId(null); setLoadingList(false); return; }
    setLoadingList(true); setError("");
    try {
      const result = await request(`/direct-messages/${encodeURIComponent(activeWorkspaceId)}/conversations`);
      setPeople(result.members || []);
      const next = result.conversations || [];
      setConversations(next);
      setConversationId((current) => {
        const selectedId = preferId || current;
        return next.some((conversation) => conversation.id === selectedId) ? selectedId : next[0]?.id || null;
      });
    } catch (loadError) { setError(loadError.message); }
    finally { setLoadingList(false); }
  }, [activeWorkspaceId, request]);

  useEffect(() => { setMessages([]); loadConversations(requestedConversationId); }, [activeWorkspaceId, loadConversations, requestedConversationId]);

  useEffect(() => {
    if (!activeWorkspaceId) return undefined;
    setPresence({});
    const socket = io(SOCKET_URL, { autoConnect: false, auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => setConnection("connected"));
    socket.on("disconnect", () => setConnection("disconnected"));
    socket.on("connect_error", (socketError) => { setConnection("disconnected"); setError(socketError.message || "Live messages connection failed."); });
    socket.on("connect", () => socket.emit("workspace:presence:join", activeWorkspaceId, (result) => {
      if (result?.success) setPresence((current) => {
        const next = { ...current };
        for (const onlineId of result.onlineUserIds) next[onlineId] = { ...(next[onlineId] || {}), isOnline: true };
        return next;
      });
    }));
    const onPresence = ({ userId, isOnline, lastSeenAt }) => setPresence((current) => ({ ...current, [userId]: { isOnline, lastSeenAt } }));
    socket.on("presence:changed", onPresence);
    const onConversation = (event) => {
      if (event.workspaceId === activeWorkspaceId) loadConversations(event.conversationId);
    };
    socket.on("dm:conversation-created", onConversation);
    socket.connect();
    return () => { socket.off("dm:conversation-created", onConversation); socket.off("presence:changed", onPresence); socket.disconnect(); };
  }, [activeWorkspaceId, loadConversations, token]);

  useEffect(() => {
    if (!activeWorkspaceId || !conversationId) { setMessages([]); return undefined; }
    let current = true;
    setLoadingMessages(true); setError("");
    request(`/direct-messages/${encodeURIComponent(activeWorkspaceId)}/conversations/${encodeURIComponent(conversationId)}/messages`)
      .then((result) => { if (current) setMessages(result.messages || []); })
      .catch((loadError) => { if (current) setError(loadError.message); })
      .finally(() => { if (current) setLoadingMessages(false); });

    const socket = io(SOCKET_URL, { autoConnect: false, auth: { token }, transports: ["websocket", "polling"] });
    directSocketRef.current = socket;
    const created = (message) => setMessages((items) => insertMessage(items, message));
    const updated = (message) => setMessages((items) => insertMessage(items, message));
    const deleted = ({ id }) => setMessages((items) => items.filter((message) => message.id !== id));
    socket.on("connect", () => socket.emit("dm:join", conversationId, (result) => {
      if (!result?.success) setError(result?.message || "Unable to join this conversation.");
    }));
    socket.on("dm:message-created", created);
    socket.on("dm:message-updated", updated);
    socket.on("dm:message-deleted", deleted);
    const onTyping = (event) => {
      if (event.scope === "direct" && event.scopeId === conversationId) setTypingUser(event.isTyping ? event.name : "");
    };
    socket.on("typing:updated", onTyping);
    socket.connect();
    return () => {
      current = false;
      socket.emit("dm:leave", conversationId);
      socket.off("dm:message-created", created); socket.off("dm:message-updated", updated); socket.off("dm:message-deleted", deleted);
      socket.off("typing:updated", onTyping);
      socket.disconnect();
      if (directSocketRef.current === socket) directSocketRef.current = null;
      clearTimeout(typingTimerRef.current);
    };
  }, [activeWorkspaceId, conversationId, request, token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  const startConversation = async (person) => {
    try {
      setError("");
      const result = await request(`/direct-messages/${encodeURIComponent(activeWorkspaceId)}/conversations`, { method: "POST", body: JSON.stringify({ userId: person.id }) });
      await loadConversations(result.conversation.id);
    } catch (startError) { setError(startError.message); }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!activeWorkspaceId || !conversationId || !draft.trim() || sending) return;
    setSending(true); setError("");
    try {
      const result = await request(`/direct-messages/${encodeURIComponent(activeWorkspaceId)}/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify({ content: draft.trim() }) });
      setMessages((items) => insertMessage(items, result.message)); setDraft("");
      await loadConversations(conversationId);
    } catch (sendError) { setError(sendError.message); }
    finally { setSending(false); }
  };

  const updateDraft = (value) => {
    setDraft(value);
    const socket = directSocketRef.current;
    if (!socket?.connected || !conversationId) return;
    socket.emit("dm:typing", { conversationId, isTyping: Boolean(value.trim()) });
    clearTimeout(typingTimerRef.current);
    if (value.trim()) typingTimerRef.current = setTimeout(() => socket.emit("dm:typing", { conversationId, isTyping: false }), 1400);
  };

  const saveEdit = async (messageId) => {
    if (!editDraft.trim() || busyId) return;
    setBusyId(messageId); setError("");
    try {
      const result = await request(`/direct-messages/${encodeURIComponent(activeWorkspaceId)}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: "PATCH", body: JSON.stringify({ content: editDraft.trim() }) });
      setMessages((items) => insertMessage(items, result.message)); setEditingId(null);
    } catch (saveError) { setError(saveError.message); }
    finally { setBusyId(null); }
  };

  const remove = async (messageId) => {
    if (busyId || !window.confirm("Delete this message?")) return;
    setBusyId(messageId); setError("");
    try {
      await request(`/direct-messages/${encodeURIComponent(activeWorkspaceId)}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
      setMessages((items) => items.filter((message) => message.id !== messageId));
    } catch (removeError) { setError(removeError.message); }
    finally { setBusyId(null); }
  };

  const activeConversation = conversations.find((conversation) => conversation.id === conversationId);
  const peerPresence = activeConversation ? presence[activeConversation.person.id] || {} : {};
  const peerLastSeen = peerPresence.lastSeenAt || activeConversation?.person.lastSeenAt;
  const filteredPeople = people.filter((person) => !search.trim() || `${person.name} ${person.email}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[#F5F5F8] px-4 py-6 text-[#292936] dark:bg-[#08090C] dark:text-[#C6C6D0] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EFFF] text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><MessageCircle size={20} /></span><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-[#92939E]">Private conversations</p><h1 className="text-2xl font-semibold tracking-tight">Direct messages</h1></div></div><label className="sr-only" htmlFor="dm-workspace-select">Workspace</label><select id="dm-workspace-select" value={activeWorkspaceId || ""} onChange={(event) => selectWorkspace(event.target.value)} className="max-w-full rounded-xl border border-[#E4E4EC] bg-white px-3 py-2.5 text-sm dark:border-[#34353F] dark:bg-[#15161C]">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></header>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {!activeWorkspace ? <section className="rounded-2xl border border-dashed border-[#DADAE4] bg-white p-10 text-center text-sm text-[#686878] dark:border-[#34353F] dark:bg-[#15161C]">Create or join a workspace to message its members.</section> : <section className="grid min-h-[min(72vh,760px)] grid-cols-1 overflow-hidden rounded-2xl border border-[#E4E4EC] bg-white dark:border-[#292A32] dark:bg-[#15161C] lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="flex max-h-[38vh] flex-col border-b border-[#EEEEF2] dark:border-[#292A32] lg:max-h-none lg:border-b-0 lg:border-r">
            <div className="border-b border-[#EEEEF2] p-4 dark:border-[#292A32]"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92939E]" /><label className="sr-only" htmlFor="dm-member-search">Find workspace members</label><input id="dm-member-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a person" className="w-full rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#8980FF] dark:border-[#34353F] dark:bg-[#101116]" /></div></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loadingList ? <div className="flex justify-center p-8 text-[#92939E]"><Loader2 className="animate-spin" size={18} /></div> : <>
                {conversations.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#92939E]">Conversations</p>}
                {conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => setConversationId(conversation.id)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${conversation.id === conversationId ? "bg-[#F0EFFF] dark:bg-[#7068FF]/10" : "hover:bg-[#F7F7FA] dark:hover:bg-white/[0.04]"}`}><Avatar person={conversation.person} online={presence[conversation.person.id]?.isOnline} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{conversation.person.name}</span><span className="mt-0.5 block truncate text-xs text-[#92939E]">{conversation.lastMessage?.content || "Start a conversation"}</span></span><span className="text-[10px] text-[#92939E]">{conversation.lastMessage ? formatTime(conversation.lastMessage.createdAt) : ""}</span></button>)}
                {filteredPeople.length > 0 && <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#92939E]">Workspace members</p>}
                {filteredPeople.map((person) => <button key={person.id} type="button" onClick={() => startConversation(person)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F7F7FA] dark:hover:bg-white/[0.04]"><Avatar person={person} online={presence[person.id]?.isOnline} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{person.name}</span><span className="block truncate text-xs text-[#92939E]">{presence[person.id]?.isOnline ? "Online" : person.email}</span></span><Plus size={15} className="text-[#92939E]" /></button>)}
                {!conversations.length && !filteredPeople.length && <div className="px-4 py-10 text-center text-sm text-[#92939E]">No other members yet. Invite members from Workspaces.</div>}
              </>}
            </div>
          </aside>

          <div className="flex min-h-[55vh] min-w-0 flex-col lg:min-h-0">
            {activeConversation ? <>
              <header className="flex items-center gap-3 border-b border-[#EEEEF2] p-4 dark:border-[#292A32] sm:px-6"><Avatar person={activeConversation.person} online={peerPresence.isOnline} /><div className="min-w-0"><h2 className="truncate font-semibold">{activeConversation.person.name}</h2><p className="text-xs text-[#92939E]">{peerPresence.isOnline ? "Online" : peerLastSeen ? `Last seen ${formatTime(peerLastSeen)}` : "Offline"}</p></div><span className="ml-auto flex items-center gap-2 text-xs text-[#92939E]"><span className={`h-2 w-2 rounded-full ${connection === "connected" ? "bg-emerald-500" : "bg-slate-300"}`} />{connection === "connected" ? "Live" : "Reconnecting"}</span></header>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite" aria-label="Direct messages">{loadingMessages ? <div className="flex justify-center py-10 text-[#92939E]"><Loader2 className="animate-spin" size={20} /></div> : messages.length === 0 ? <div className="py-16 text-center"><MessageCircle size={28} className="mx-auto mb-3 text-[#C4C4CF]" /><p className="text-sm text-[#686878] dark:text-[#92939E]">Say hello to {activeConversation.person.name}.</p></div> : messages.map((message) => { const own = message.senderId === user?.id; const editing = editingId === message.id; return <article key={message.id} className="group flex gap-3"><Avatar person={message.sender} online={presence[message.senderId]?.isOnline} /><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-baseline gap-x-2"><span className="text-sm font-semibold">{message.sender?.name || "Member"}</span><time dateTime={message.createdAt} className="text-xs text-[#92939E]">{formatTime(message.createdAt)}</time>{message.editedAt && <span className="text-xs text-[#92939E]">edited</span>}{own && !editing && <div className="ml-auto flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><button type="button" onClick={() => { setEditingId(message.id); setEditDraft(message.content); }} aria-label="Edit message" className="rounded-md p-1.5 text-[#92939E] hover:bg-[#F5F5F8] hover:text-[#292936] dark:hover:bg-white/5"><Pencil size={14} /></button><button type="button" onClick={() => remove(message.id)} disabled={busyId === message.id} aria-label="Delete message" className="rounded-md p-1.5 text-[#92939E] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 size={14} /></button></div>}</div>{editing ? <div className="space-y-2"><textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} rows={3} className="w-full resize-y rounded-lg border border-[#E4E4EC] bg-[#FAFAFC] px-3 py-2 text-sm outline-none focus:border-[#8980FF] dark:border-[#34353F] dark:bg-[#101116]" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[#686878]"><X size={14} />Cancel</button><button type="button" onClick={() => saveEdit(message.id)} disabled={!editDraft.trim() || busyId === message.id} className="rounded-lg bg-[#6258E8] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save</button></div></div> : <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#555565] dark:text-[#C6C6D0]">{message.content}</p>}</div></article>; })}{typingUser && <p className="pl-12 text-xs text-[#92939E]">{typingUser} is typing…</p>}<div ref={bottomRef} /></div>
              <form onSubmit={send} className="flex items-end gap-3 border-t border-[#EEEEF2] p-4 dark:border-[#292A32] sm:p-5"><label className="sr-only" htmlFor="direct-message-composer">Write a message</label><textarea id="direct-message-composer" value={draft} onChange={(event) => updateDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} rows={2} placeholder={`Message ${activeConversation.person.name}…`} className="min-h-12 flex-1 resize-y rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] px-3.5 py-3 text-sm outline-none focus:border-[#8980FF] dark:border-[#34353F] dark:bg-[#101116]" /><button type="submit" disabled={!draft.trim() || sending} className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#6258E8] px-4 text-sm font-semibold text-white hover:bg-[#554BD8] disabled:opacity-50"><Send size={16} /><span className="hidden sm:inline">{sending ? "Sending…" : "Send"}</span></button></form>
            </> : <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EFFF] text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><UserRound size={25} /></span><h2 className="mt-4 text-lg font-semibold">Choose someone to message</h2><p className="mt-2 max-w-sm text-sm text-[#686878] dark:text-[#92939E]">Select a conversation or start one with any member of this workspace.</p></div>}
          </div>
        </section>}
      </div>
    </main>
  );
}

function Avatar({ person, online = false }) {
  return <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F0EFFF] text-xs font-semibold text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]">{person?.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : (person?.name || "?").slice(0, 1).toUpperCase()}{online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-[#15161C]" />}</span>;
}
