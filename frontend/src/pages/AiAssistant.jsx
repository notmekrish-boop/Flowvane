import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Plus, Sparkles, User, Loader2, Check, X, MessageSquare, Trash2, Pencil, Check as Save, X as Close, Brain, Trash } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = "http://localhost:5000/api";
const starterPrompts = [
  "Help me plan a new project",
  "How can I prioritize my tasks?",
  "Create a productive weekly schedule",
  "Give me tips to improve team collaboration",
];

function AiAssistant() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [proposalBusy, setProposalBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [memories, setMemories] = useState([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const messageEndRef = useRef(null);

  const apiRequest = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Request failed.");
    return data;
  }, [token]);

  const loadConversationList = useCallback(async () => {
    const data = await apiRequest("/conversations");
    setConversations(data.conversations || []);
  }, [apiRequest]);

  const loadMemories = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const data = await apiRequest("/memories");
      setMemories(data.memories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setMemoryLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        setHistoryLoading(true);
        const data = await apiRequest("/conversations");
        if (active) setConversations(data.conversations || []);
        const memoryData = await apiRequest("/memories");
        if (active) setMemories(memoryData.memories || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setHistoryLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token, apiRequest]);

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function openConversation(id) {
    if (loading || proposalBusy) return;
    setError(""); setHistoryLoading(true);
    try {
      const data = await apiRequest(`/conversations/${id}`);
      setConversationId(data.conversation.id);
      setMessages((data.conversation.messages || []).map((item) => ({
        id: item.id, role: item.role, text: item.text, proposal: item.proposal || null,
        proposalType: item.proposalType || null, proposalStatus: item.proposalStatus || null,
      })));
      setInput("");
    } catch (err) { setError(err.message); }
    finally { setHistoryLoading(false); }
  }

  function startNewChat() {
    if (loading || proposalBusy) return;
    setConversationId(null); setMessages([]); setInput(""); setError("");
  }

  async function ensureConversation(firstMessage) {
    if (conversationId) return conversationId;
    const data = await apiRequest("/conversations", { method: "POST", body: JSON.stringify({ title: firstMessage }) });
    setConversationId(data.conversation.id);
    setConversations((current) => [data.conversation, ...current]);
    return data.conversation.id;
  }

  async function saveMessage(id, item) {
    const data = await apiRequest(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: item.role, text: item.text, proposal: item.proposal || null,
        proposalType: item.proposalType || null, proposalStatus: item.proposalStatus || null }),
    });
    return data.message;
  }

  async function sendMessage(text = input) {
    const message = text.trim();
    if (!message || loading) return;
    const previousMessages = messages;
    const optimisticUser = { role: "user", text: message };
    setMessages((current) => [...current, optimisticUser]);
    setInput(""); setError(""); setLoading(true);
    try {
      const id = await ensureConversation(message);
      await saveMessage(id, optimisticUser);
      const data = await apiRequest("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message, history: previousMessages.map((item) => ({ role: item.role, text: item.text })) }),
      });
      const assistantMessage = {
        role: "model", text: data.reply || "I couldn't generate a response.",
        proposal: ["create_task", "update_task"].includes(data.type) ? data.proposal : null,
        proposalType: ["create_task", "update_task"].includes(data.type) ? data.type : null,
        proposalStatus: ["create_task", "update_task"].includes(data.type) ? "pending" : null,
      };
      const saved = await saveMessage(id, assistantMessage);
      setMessages((current) => [...current, { ...assistantMessage, id: saved.id }]);
      await loadConversationList();
      await loadMemories();
    } catch (err) { setError(err.message || "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  async function updateSavedMessage(item, updates) {
    if (!conversationId || !item.id) return;
    await apiRequest(`/conversations/${conversationId}/messages/${item.id}`, {
      method: "PATCH", body: JSON.stringify(updates),
    });
  }

  async function confirmTask(messageIndex) {
    const item = messages[messageIndex];
    if (!item?.proposal || item.proposalStatus !== "pending" || proposalBusy) return;
    setProposalBusy(true); setError("");
    try {
      const p = item.proposal;
      const isUpdate = item.proposalType === "update_task";
      const url = isUpdate ? `/tasks/${p.taskId}` : `/tasks/projects/${p.projectId}/tasks`;
      const body = isUpdate
        ? Object.fromEntries(Object.entries(p.changes || {}).map(([key, value]) => [key, key === "assigneeId" || key === "dueDate" ? (value || null) : value]))
        : { title: p.title, description: p.description, priority: p.priority, ...(p.dueDate ? { dueDate: p.dueDate } : {}) };
      const data = await apiRequest(url, { method: isUpdate ? "PATCH" : "POST", body: JSON.stringify(body) });
      const updated = { ...item, proposalStatus: "created",
        text: `${item.text}\n\n${isUpdate ? `**Task updated successfully:** ${data.task?.title || p.taskTitle}` : `**Task created successfully:** ${data.task?.title || p.title}`}` };
      await updateSavedMessage(item, { proposalStatus: "created", text: updated.text });
      setMessages((current) => current.map((entry, index) => index === messageIndex ? updated : entry));
    } catch (err) { setError(err.message || "Unable to complete the task action."); }
    finally { setProposalBusy(false); loadConversationList().catch(() => {}); }
  }

  async function cancelTask(messageIndex) {
    const item = messages[messageIndex];
    if (!item || item.proposalStatus !== "pending" || proposalBusy) return;
    try {
      await updateSavedMessage(item, { proposalStatus: "cancelled" });
      setMessages((current) => current.map((entry, index) => index === messageIndex ? { ...entry, proposalStatus: "cancelled" } : entry));
    } catch (err) { setError(err.message); }
  }

  async function editMemory(memory) {
    const content = window.prompt("Edit this saved memory:", memory.content);
    if (content === null || !content.trim()) return;
    const category = window.prompt("Category: project, goal, preference, workflow", memory.category);
    if (category === null) return;
    try {
      await apiRequest(`/memories/${memory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: content.trim(), category: category.trim().toLowerCase() }),
      });
      await loadMemories();
    } catch (err) { setError(err.message); }
  }

  async function deleteMemory(id) {
    if (!window.confirm("Delete this saved memory?")) return;
    try {
      await apiRequest(`/memories/${id}`, { method: "DELETE" });
      setMemories((current) => current.filter((memory) => memory.id !== id));
    } catch (err) { setError(err.message); }
  }

  async function renameConversation(id) {
    if (!editingTitle.trim()) return;
    try {
      const data = await apiRequest(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title: editingTitle }) });
      setConversations((current) => current.map((item) => item.id === id ? { ...item, title: data.conversation.title } : item));
      setEditingId(null); setEditingTitle("");
    } catch (err) { setError(err.message); }
  }

  async function deleteConversation(id) {
    if (!window.confirm("Delete this conversation and all its messages?")) return;
    try {
      await apiRequest(`/conversations/${id}`, { method: "DELETE" });
      setConversations((current) => current.filter((item) => item.id !== id));
      if (conversationId === id) startNewChat();
    } catch (err) { setError(err.message); }
  }

  function handleSubmit(event) { event.preventDefault(); sendMessage(); }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-3 py-4 sm:px-5 lg:px-8">
      <div className="mx-auto flex h-[calc(100vh-112px)] max-w-7xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <aside className={`${sidebarOpen ? "flex" : "hidden"} w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 md:flex`}>
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-800">Chat history</h2>
            <button onClick={startNewChat} className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700" title="New chat"><Plus size={17} /></button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {historyLoading && <p className="p-3 text-xs text-slate-500">Loading chats...</p>}
            {!historyLoading && conversations.length === 0 && <p className="p-3 text-sm text-slate-500">Your saved conversations will appear here.</p>}
            {conversations.map((conversation) => (
              <div key={conversation.id} className={`group rounded-xl p-2 ${conversationId === conversation.id ? "bg-blue-100" : "hover:bg-white"}`}>
                {editingId === conversation.id ? (
                  <div className="flex gap-1">
                    <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" autoFocus />
                    <button onClick={() => renameConversation(conversation.id)} title="Save"><Save size={15} /></button>
                    <button onClick={() => setEditingId(null)} title="Cancel"><Close size={15} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openConversation(conversation.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-slate-700">
                      <MessageSquare size={15} className="shrink-0 text-slate-400" /><span className="truncate">{conversation.title}</span>
                    </button>
                    <button onClick={() => { setEditingId(conversation.id); setEditingTitle(conversation.title); }} className="hidden rounded p-1 text-slate-400 hover:text-blue-600 group-hover:block" title="Rename"><Pencil size={13} /></button>
                    <button onClick={() => deleteConversation(conversation.id)} className="hidden rounded p-1 text-slate-400 hover:text-red-600 group-hover:block" title="Delete"><Trash2 size={13} /></button>
                  </div>
                )}
                <p className="ml-6 mt-1 truncate text-[11px] text-slate-400">{conversation.messages?.[0]?.text || new Date(conversation.updatedAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 p-3 text-xs text-slate-400">Your chats are private to your account.</div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded-lg border px-2 py-2 text-slate-500 md:hidden" onClick={() => setSidebarOpen((value) => !value)} title="Toggle history"><MessageSquare size={17} /></button>
              <div className="rounded-xl bg-blue-600 p-2.5 text-white"><Bot size={23} /></div>
              <div><h1 className="font-semibold text-slate-900">TaskPilot AI</h1><p className="text-xs text-slate-500">Your productivity assistant</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setMemoryOpen(true); loadMemories(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Brain size={16} /><span>Memory</span>
              </button>
              <button type="button" onClick={startNewChat} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Plus size={16} /><span>New chat</span></button>
            </div>
          </header>

          {memoryOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
              <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Brain size={22} /></div>
                    <div><h2 className="font-semibold text-slate-900">TaskPilot AI Memory</h2><p className="text-xs text-slate-500">Facts saved from your conversations</p></div>
                  </div>
                  <button onClick={() => setMemoryOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close memory panel"><X size={19} /></button>
                </div>
                <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
                  {memoryLoading && <p className="text-sm text-slate-500">Loading memories...</p>}
                  {!memoryLoading && memories.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                      <Brain className="mx-auto mb-2 text-slate-400" size={26} />
                      <p className="font-medium text-slate-700">No saved memories yet</p>
                      <p className="mt-1 text-sm text-slate-500">TaskPilot AI may save useful project details, goals and preferences that you explicitly share.</p>
                    </div>
                  )}
                  {memories.map((memory) => (
                    <div key={memory.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                      <div className="min-w-0 flex-1">
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium capitalize text-blue-700">{memory.category}</span>
                        <p className="mt-2 break-words text-sm text-slate-800">{memory.content}</p>
                        <p className="mt-2 text-[11px] text-slate-400">Updated {new Date(memory.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => editMemory(memory)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600" title="Edit memory"><Pencil size={15} /></button>
                        <button onClick={() => deleteMemory(memory.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete memory"><Trash size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">You control these memories. Sensitive information is not intentionally saved.</div>
              </div>
            </div>
          )}

          <section className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center text-center">
                <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-blue-600"><Sparkles size={30} /></div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">How can I help you today?</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">Ask me about project planning, task prioritization, productivity, or managing your team's work.</p>
                <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                  {starterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)} disabled={loading} className="rounded-xl border border-slate-200 p-4 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">{prompt}</button>)}
                </div>
              </div>
            ) : messages.map((item, index) => (
              <div key={item.id || `${item.role}-${index}`} className={`flex items-start gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                {item.role === "model" && <div className="mt-1 rounded-lg bg-blue-600 p-2 text-white"><Bot size={17} /></div>}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[75%] ${item.role === "user" ? "rounded-tr-md bg-blue-600 text-white" : "rounded-tl-md bg-slate-100 text-slate-800"}`}>
                  {item.role === "model" ? <div className="prose prose-sm max-w-none break-words prose-headings:font-bold prose-headings:text-slate-900 prose-p:my-2 prose-li:my-1 prose-strong:text-slate-900 prose-code:rounded prose-code:bg-slate-200 prose-code:px-1 prose-code:py-0.5 prose-code:text-blue-700 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:p-4 prose-pre:text-white prose-table:block prose-table:overflow-x-auto"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown></div> : <p className="whitespace-pre-wrap break-words">{item.text}</p>}
                  {item.proposal && (
                    <div className="mt-4 w-full min-w-[250px] rounded-xl border border-blue-200 bg-white p-4 text-slate-800 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{item.proposalType === "update_task" ? "Task update proposal" : "Task proposal"}</h3><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{item.proposalStatus === "created" ? "Completed" : item.proposalStatus === "cancelled" ? "Cancelled" : "Needs confirmation"}</span></div>
                      <p className="text-xs text-slate-500">Project</p><p className="mb-3 font-medium">{item.proposal.projectName}</p>
                      {item.proposalType === "update_task" ? <>
                        <p className="text-xs text-slate-500">Existing task</p><p className="mb-3 font-medium">{item.proposal.taskTitle}</p>
                        <div className="space-y-3">{(item.proposal.changeFields || []).map((field) => {
                          const labels = { title: "New title", description: "New description", status: "New status", priority: "New priority", assigneeId: "New assignee", dueDate: "New due date" };
                          const values = item.proposal.changes || {};
                          const displayValue = field === "assigneeId" ? (values.assigneeName || "Unassigned") : field === "dueDate" ? (values.dueDate || "Remove due date") : field === "description" ? (values.description || "Clear description") : field === "status" ? ({ TODO: "To Do", IN_PROGRESS: "In Progress", COMPLETED: "Completed" }[values.status] || values.status) : field === "priority" ? values.priority : values[field];
                          return <div key={field}><p className="text-xs text-slate-500">{labels[field]}</p><p className="font-medium break-words">{displayValue}</p></div>;
                        })}</div>
                      </> : <>
                        <p className="text-xs text-slate-500">Task title</p><p className="mb-3 font-medium">{item.proposal.title}</p>
                        {item.proposal.description && <><p className="text-xs text-slate-500">Description</p><p className="mb-3 text-sm">{item.proposal.description}</p></>}
                        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-slate-100 px-2 py-1">Priority: {item.proposal.priority}</span>{item.proposal.dueDate && <span className="rounded-lg bg-slate-100 px-2 py-1">Due: {item.proposal.dueDate}</span>}</div>
                      </>}
                      {item.proposalStatus === "pending" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => confirmTask(index)} disabled={proposalBusy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Check size={15} />{item.proposalType === "update_task" ? "Confirm update" : "Confirm and create"}</button><button type="button" onClick={() => cancelTask(index)} disabled={proposalBusy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><X size={15} />Cancel</button></div>}
                    </div>
                  )}
                </div>
                {item.role === "user" && <div className="mt-1 rounded-lg bg-slate-200 p-2 text-slate-600"><User size={17} /></div>}
              </div>
            ))}
            {loading && <div className="flex items-center gap-3"><div className="rounded-lg bg-blue-600 p-2 text-white"><Bot size={17} /></div><div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />TaskPilot AI is thinking...</div></div>}
            <div ref={messageEndRef} />
            {error && <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          </section>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4 sm:p-5">
            <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleSubmit(event); } }} rows={1} maxLength={4000} placeholder="Message TaskPilot AI..." className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
              <button type="submit" disabled={!input.trim() || loading} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" aria-label="Send message"><Send size={17} /></button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">Enter to send · Shift + Enter for a new line</p>
          </form>
        </section>
      </div>
    </main>
  );
}
export default AiAssistant;
