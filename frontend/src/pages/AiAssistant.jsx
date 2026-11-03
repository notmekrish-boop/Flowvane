import { useState } from "react";
import { Bot, Send, Plus, Sparkles, User, Loader2, Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const starterPrompts = [
  "Help me plan a new project",
  "How can I prioritize my tasks?",
  "Create a productive weekly schedule",
  "Give me tips to improve team collaboration",
];

function AiAssistant() {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [proposalBusy, setProposalBusy] = useState(false);

  async function sendMessage(text = input) {
    const message = text.trim();
    if (!message || loading) return;

    const previousMessages = messages;
    setMessages((current) => [...current, { role: "user", text: message }]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          history: previousMessages.map((item) => ({
            role: item.role,
            text: item.text,
          })),
        }),
      });

      const data = await response.json();
      console.log("Gemini raw response:", JSON.stringify(data.reply));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to get a response. Please try again.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: data.reply || "I couldn't generate a response.",
          proposal: ["create_task", "update_task"].includes(data.type) ? data.proposal : null,
          proposalType: data.type === "update_task" ? "update_task" : "create_task",
          proposalStatus: ["create_task", "update_task"].includes(data.type) ? "pending" : null,
        },
      ]);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }


  async function confirmTask(messageIndex) {
    const item = messages[messageIndex];
    if (!item?.proposal || item.proposalStatus !== "pending" || proposalBusy) return;
    setProposalBusy(true);
    setError("");
    try {
      const p = item.proposal;
      const isUpdate = item.proposalType === "update_task";
      const url = isUpdate
        ? `http://localhost:5000/api/tasks/${p.taskId}`
        : `http://localhost:5000/api/tasks/projects/${p.projectId}/tasks`;
      const body = isUpdate
        ? {
            ...(p.changeAssignee ? { assigneeId: p.assigneeId || null } : {}),
            ...(p.changeDueDate ? { dueDate: p.dueDate || null } : {}),
          }
        : {
            title: p.title,
            description: p.description,
            priority: p.priority,
            ...(p.dueDate ? { dueDate: p.dueDate } : {}),
          };

      const response = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || (isUpdate ? "Task update failed." : "Task creation failed."));
      }

      const successText = isUpdate
        ? `**Task updated successfully:** ${data.task?.title || p.taskTitle}`
        : `**Task created successfully:** ${data.task?.title || p.title}`;
      setMessages((current) => current.map((entry, index) => index === messageIndex
        ? { ...entry, proposalStatus: "created", text: `${entry.text}\n\n${successText}` }
        : entry));
    } catch (err) {
      setError(err.message || "Unable to complete the task action.");
    } finally {
      setProposalBusy(false);
    }
  }

  function cancelTask(messageIndex) {
    setMessages((current) => current.map((entry, index) => index === messageIndex
      ? { ...entry, proposalStatus: "cancelled" }
      : entry));
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function startNewChat() {
    if (loading) return;
    setMessages([]);
    setInput("");
    setError("");
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-[calc(100vh-120px)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-2.5 text-white">
              <Bot size={23} />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">TaskPilot AI</h1>
              <p className="text-xs text-slate-500">Your productivity assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </header>

        <section className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center text-center">
              <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-blue-600">
                <Sparkles size={30} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                How can I help you today?
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Ask me about project planning, task prioritization, productivity,
                or managing your team's work.
              </p>
              <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className="rounded-xl border border-slate-200 p-4 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`flex items-start gap-3 ${
                  item.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {item.role === "model" && (
                  <div className="mt-1 rounded-lg bg-blue-600 p-2 text-white">
                    <Bot size={17} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[75%] ${
                    item.role === "user"
                      ? "rounded-tr-md bg-blue-600 text-white"
                      : "rounded-tl-md bg-slate-100 text-slate-800"
                  }`}
                >
                  {item.role === "model" ? (
  <div className="prose prose-sm max-w-none break-words prose-headings:font-bold prose-headings:text-slate-900 prose-p:my-2 prose-li:my-1 prose-strong:text-slate-900 prose-code:rounded prose-code:bg-slate-200 prose-code:px-1 prose-code:py-0.5 prose-code:text-blue-700 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:p-4 prose-pre:text-white prose-table:block prose-table:overflow-x-auto">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {item.text}
    </ReactMarkdown>
  </div>
) : (
  <p className="whitespace-pre-wrap break-words">{item.text}</p>
)}
                  {item.proposal && (
                    <div className="mt-4 w-full min-w-[250px] rounded-xl border border-blue-200 bg-white p-4 text-slate-800 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{item.proposalType === "update_task" ? "Task update proposal" : "Task proposal"}</h3>
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                          {item.proposalStatus === "created" ? "Completed" : item.proposalStatus === "cancelled" ? "Cancelled" : "Needs confirmation"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Project</p>
                      <p className="mb-3 font-medium">{item.proposal.projectName}</p>
                      {item.proposalType === "update_task" ? (
                        <>
                          <p className="text-xs text-slate-500">Existing task</p>
                          <p className="mb-3 font-medium">{item.proposal.taskTitle}</p>
                          {item.proposal.changeAssignee && <>
                            <p className="text-xs text-slate-500">Assign to</p>
                            <p className="mb-3 font-medium">{item.proposal.assigneeName}</p>
                          </>}
                          {item.proposal.changeDueDate && <>
                            <p className="text-xs text-slate-500">Due date</p>
                            <p className="mb-3 font-medium">{item.proposal.dueDate || "Remove due date"}</p>
                          </>}
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-slate-500">Task title</p>
                          <p className="mb-3 font-medium">{item.proposal.title}</p>
                          {item.proposal.description && <><p className="text-xs text-slate-500">Description</p><p className="mb-3 text-sm">{item.proposal.description}</p></>}
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-lg bg-slate-100 px-2 py-1">Priority: {item.proposal.priority}</span>
                            {item.proposal.dueDate && <span className="rounded-lg bg-slate-100 px-2 py-1">Due: {item.proposal.dueDate}</span>}
                          </div>
                        </>
                      )}
                      {item.proposalStatus === "pending" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => confirmTask(index)} disabled={proposalBusy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                            <Check size={15} />{item.proposalType === "update_task" ? "Confirm update" : "Confirm and create"}
                          </button>
                          <button type="button" onClick={() => cancelTask(index)} disabled={proposalBusy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                            <X size={15} />Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {item.role === "user" && (
                  <div className="mt-1 rounded-lg bg-slate-200 p-2 text-slate-600">
                    <User size={17} />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-600 p-2 text-white">
                <Bot size={17} />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                TaskPilot AI is thinking...
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4 sm:p-5">
          <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Message TaskPilot AI..."
              className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            Enter to send · Shift + Enter for a new line
          </p>
        </form>
      </div>
    </main>
  );
}

export default AiAssistant;
