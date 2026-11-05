import { useEffect, useState } from "react";
import { BriefcaseBusiness, Check, ChevronDown, Loader2, MailPlus, Plus, RefreshCw, Shield, Trash2, Users } from "../components/icons";
import { useWorkspace } from "../context/WorkspaceContext";

const surface = "rounded-2xl border border-[#E4E4EC] bg-white dark:border-[#292A32] dark:bg-[#15161C]";
const input = "w-full rounded-xl border border-[#E4E4EC] bg-[#FAFAFC] px-3.5 py-2.5 text-sm text-[#292936] outline-none focus:border-[#8980FF] focus:ring-2 focus:ring-[#6258E8]/10 dark:border-[#34353F] dark:bg-[#101116] dark:text-[#C6C6D0]";

export default function Workspaces() {
  const { workspaces, activeWorkspace, activeWorkspaceId, selectWorkspace, createWorkspace, refreshWorkspaces, request, loadingWorkspaces } = useWorkspace();
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!activeWorkspace) return;
    setName(activeWorkspace.name);
    setLoadingMembers(true);
    request(`/workspaces/${encodeURIComponent(activeWorkspace.id)}/members`)
      .then((result) => setMembers(result.members || []))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoadingMembers(false));
  }, [activeWorkspace?.id, request]);

  const run = async (action, successText) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(successText); }
    catch (actionError) { setError(actionError.message); }
    finally { setBusy(false); }
  };

  const saveName = (event) => {
    event.preventDefault();
    if (!activeWorkspace) return;
    run(async () => {
      await request(`/workspaces/${encodeURIComponent(activeWorkspace.id)}`, { method: "PATCH", body: JSON.stringify({ name }) });
      await refreshWorkspaces();
    }, "Workspace name updated.");
  };

  const addMember = (event) => {
    event.preventDefault();
    if (!activeWorkspace) return;
    run(async () => {
      await request(`/workspaces/${encodeURIComponent(activeWorkspace.id)}/members`, { method: "POST", body: JSON.stringify({ email }) });
      setEmail("");
      const result = await request(`/workspaces/${encodeURIComponent(activeWorkspace.id)}/members`);
      setMembers(result.members || []);
      await refreshWorkspaces();
    }, "Member added to workspace.");
  };

  const updateRole = (member, role) => run(async () => {
    await request(`/workspaces/${encodeURIComponent(activeWorkspace.id)}/members/${encodeURIComponent(member.id)}`, { method: "PATCH", body: JSON.stringify({ role }) });
    const result = await request(`/workspaces/${encodeURIComponent(activeWorkspace.id)}/members`);
    setMembers(result.members || []);
  }, "Member role updated.");

  const removeMember = (member) => {
    if (!window.confirm(`Remove ${member.user.name} from this workspace?`)) return;
    run(async () => {
      await request(`/workspaces/${encodeURIComponent(activeWorkspace.id)}/members/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      setMembers((current) => current.filter((item) => item.id !== member.id));
      await refreshWorkspaces();
    }, "Member removed from workspace.");
  };

  const submitWorkspace = (event) => {
    event.preventDefault();
    run(async () => {
      const workspace = await createWorkspace(newWorkspaceName);
      setNewWorkspaceName("");
      setName(workspace.name);
    }, "Workspace created.");
  };

  const canManage = activeWorkspace?.role === "OWNER" || activeWorkspace?.role === "ADMIN";
  const isOwner = activeWorkspace?.role === "OWNER";

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[#F5F5F8] px-5 py-8 text-[#292936] dark:bg-[#08090C] dark:text-[#C6C6D0] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#92939E]"><BriefcaseBusiness size={14} /> Collaboration</div>
            <h1 className="text-3xl font-semibold tracking-tight">Workspaces</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#686878] dark:text-[#92939E]">Manage workspace access and member roles. Project access remains controlled by each project’s membership.</p>
          </div>
          <button type="button" onClick={() => refreshWorkspaces()} disabled={loadingWorkspaces} className="inline-flex items-center gap-2 rounded-xl border border-[#E4E4EC] bg-white px-4 py-2.5 text-sm font-medium text-[#555565] hover:bg-[#FAFAFC] disabled:opacity-50 dark:border-[#34353F] dark:bg-[#15161C] dark:text-[#C6C6D0]"><RefreshCw size={15} className={loadingWorkspaces ? "animate-spin" : ""} />Refresh</button>
        </header>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
        {notice && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"><Check size={16} />{notice}</div>}

        <form onSubmit={submitWorkspace} className={`${surface} mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
          <label className="min-w-0 flex-1 text-sm font-medium">Create a workspace<input value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} maxLength={80} required placeholder="e.g. Design Studio" className={`${input} mt-2`} /></label>
          <button type="submit" disabled={busy || !newWorkspaceName.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6258E8] px-4 text-sm font-semibold text-white hover:bg-[#554BD8] disabled:opacity-50"><Plus size={16} />Create workspace</button>
        </form>

        {loadingWorkspaces && !workspaces.length ? <div className="flex justify-center py-16 text-[#92939E]"><Loader2 className="animate-spin" /></div> : !activeWorkspace ? (
          <div className={`${surface} p-8 text-center text-sm text-[#686878]`}>No workspaces yet. Create one to get started.</div>
        ) : <>
          <label className={`${surface} mb-5 flex items-center gap-3 p-4`}>
            <BriefcaseBusiness className="shrink-0 text-[#6258E8]" size={18} />
            <span className="sr-only">Select workspace</span>
            <select value={activeWorkspaceId || ""} onChange={(event) => selectWorkspace(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none">
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role.toLowerCase()}</option>)}
            </select>
            <ChevronDown className="text-[#92939E]" size={16} />
          </label>

          <section className={`${surface} mb-5 p-5 sm:p-6`}>
            <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-[#F0EFFF] p-2.5 text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><BriefcaseBusiness size={19} /></span><div><h2 className="font-semibold">Workspace details</h2><p className="text-sm text-[#686878] dark:text-[#92939E]">Your role: {activeWorkspace.role.toLowerCase()}</p></div></div>
            <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm font-medium">Workspace name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} disabled={!canManage} className={`${input} mt-2 disabled:opacity-60`} /></label>
              {canManage && <button disabled={busy || !name.trim() || name === activeWorkspace.name} className="h-10 rounded-xl border border-[#E4E4EC] px-4 text-sm font-medium text-[#555565] hover:bg-[#FAFAFC] disabled:opacity-45 dark:border-[#34353F] dark:text-[#C6C6D0] dark:hover:bg-white/[0.04]">Save name</button>}
            </form>
          </section>

          <section className={`${surface} p-5 sm:p-6`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Users size={18} className="text-[#6258E8]" /><h2 className="font-semibold">Members</h2></div><p className="mt-1 text-sm text-[#686878] dark:text-[#92939E]">{members.length} people have access to this workspace.</p></div>{canManage && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0EFFF] px-3 py-1 text-xs font-medium text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]"><Shield size={13} />Admin controls</span>}</div>
            {canManage && <form onSubmit={addMember} className="mb-5 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="workspace-invite-email">Member email</label><input id="workspace-invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Invite by account email" required className={input} />
              <button type="submit" disabled={busy || !email.trim()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6258E8] px-4 text-sm font-semibold text-white hover:bg-[#554BD8] disabled:opacity-50"><MailPlus size={16} />Add member</button>
            </form>}
            {loadingMembers ? <div className="py-8 text-center text-sm text-[#92939E]">Loading members…</div> : <div className="divide-y divide-[#EEEEF2] dark:divide-[#292A32]">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F0EFFF] text-sm font-semibold text-[#6258E8] dark:bg-[#7068FF]/10 dark:text-[#A49EFF]">{member.user.avatarUrl ? <img src={member.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : member.user.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.user.name}</p><p className="truncate text-xs text-[#92939E]">{member.user.email}</p></div>
              <span className="rounded-full border border-[#E5E5EC] px-2.5 py-1 text-xs text-[#686878] dark:border-[#34353F] dark:text-[#A5A6B0]">{member.role.toLowerCase()}</span>
              {member.role !== "OWNER" && canManage && <div className="flex items-center gap-2">
                {isOwner && <select aria-label={`Role for ${member.user.name}`} value={member.role} onChange={(event) => updateRole(member, event.target.value)} disabled={busy} className="rounded-lg border border-[#E4E4EC] bg-white px-2 py-1.5 text-xs dark:border-[#34353F] dark:bg-[#101116]"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select>}
                <button type="button" onClick={() => removeMember(member)} disabled={busy || (!isOwner && member.role === "ADMIN")} aria-label={`Remove ${member.user.name}`} title="Remove member" className="rounded-lg p-2 text-[#92939E] hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"><Trash2 size={15} /></button>
              </div>}
            </div>)}</div>}
          </section>
        </>}
      </div>
    </main>
  );
}
