import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  BriefcaseBusiness,
  Loader2,
  Mail,
} from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../lib/api.js";


function StatCard({ label, value, helper, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-slate-100 text-slate-600 dark:bg-[#202127] dark:text-[#C6C6D0]",
    green: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    violet: "bg-[#F1EDFF] text-[#7068FF] dark:bg-[#24212F] dark:text-[#A49CFF]"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#292A32] dark:bg-[#15161C] dark:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-[#92939E]">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-[#C6C6D0]">{value}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-[#777984]">{helper}</p>
        </div>
        <div className={`rounded-xl p-3 ${tones[tone]}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortBy, setSortBy] = useState("workload");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function request(path) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `Request failed: ${path}`);
    }
    return result;
  }

  async function loadTeamData() {
    if (!token) return;

    try {
      setLoading(true);
      setError("");

      const [projectResult, taskResult] = await Promise.all([
        request("/projects"),
        request("/tasks")
      ]);

      const projectList = projectResult.projects || [];
      const taskList = taskResult.tasks || [];

      const memberResults = await Promise.all(
        projectList.map(async (project) => {
          try {
            const result = await request(`/projects/${project.id}/members`);
            return (result.members || []).map((membership) => ({
              ...membership,
              projectId: project.id,
              projectName: project.name
            }));
          } catch {
            return [];
          }
        })
      );

      const membershipRows = memberResults.flat();
      const memberMap = new Map();

      membershipRows.forEach((membership) => {
        const memberId = membership.userId || membership.user?.id;
        if (!memberId) return;

        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            id: memberId,
            name: membership.user?.name || "Unknown user",
            email: membership.user?.email || "",
            projects: [],
            roles: []
          });
        }

        const member = memberMap.get(memberId);
        if (!member.projects.some((project) => project.id === membership.projectId)) {
          member.projects.push({
            id: membership.projectId,
            name: membership.projectName
          });
        }
        if (!member.roles.includes(membership.role)) {
          member.roles.push(membership.role);
        }
      });

      // Include assigned users even if a membership endpoint omits them.
      taskList.forEach((task) => {
        if (!task.assigneeId || !task.assignee) return;
        if (!memberMap.has(task.assigneeId)) {
          memberMap.set(task.assigneeId, {
            id: task.assigneeId,
            name: task.assignee.name || "Unknown user",
            email: task.assignee.email || "",
            projects: [],
            roles: []
          });
        }
        const member = memberMap.get(task.assigneeId);
        const project = projectList.find((item) => item.id === task.projectId);
        if (project && !member.projects.some((item) => item.id === project.id)) {
          member.projects.push({ id: project.id, name: project.name });
        }
      });

      setProjects(projectList);
      setTasks(taskList);
      setMembers(Array.from(memberMap.values()));
    } catch (err) {
      setError(err.message || "Unable to load team data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeamData();
  }, [token]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const assignedTasks = tasks.filter((task) => task.assigneeId);
  const completedTasks = tasks.filter((task) => task.status === "COMPLETED");
  const openTasks = tasks.filter((task) => task.status !== "COMPLETED");
  const overdueTasks = openTasks.filter(
    (task) => task.dueDate && new Date(task.dueDate) < today
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members
      .filter((member) => {
        const matchesSearch =
          !query ||
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query);
        const matchesProject =
          projectFilter === "all" ||
          member.projects.some((project) => project.id === projectFilter);

        return matchesSearch && matchesProject;
      })
      .sort((a, b) => {
        const aTasks = tasks.filter(
          (task) => task.assigneeId === a.id && task.status !== "COMPLETED"
        ).length;
        const bTasks = tasks.filter(
          (task) => task.assigneeId === b.id && task.status !== "COMPLETED"
        ).length;

        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "completion") {
          const aAll = tasks.filter((task) => task.assigneeId === a.id);
          const bAll = tasks.filter((task) => task.assigneeId === b.id);
          const aRate = aAll.length
            ? aAll.filter((task) => task.status === "COMPLETED").length / aAll.length
            : 0;
          const bRate = bAll.length
            ? bAll.filter((task) => task.status === "COMPLETED").length / bAll.length
            : 0;
          return bRate - aRate;
        }
        return bTasks - aTasks;
      });
  }, [members, tasks, search, projectFilter, sortBy]);

  const maxWorkload = Math.max(
    1,
    ...members.map(
      (member) =>
        tasks.filter(
          (task) => task.assigneeId === member.id && task.status !== "COMPLETED"
        ).length
    )
  );

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-50 px-5 py-8 md:px-8 dark:bg-[#08090C]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-[#C6C6D0]">
              Team
            </h1>
            <p className="mt-1 text-slate-500 dark:text-[#92939E]">
              Understand your team's workload and project participation.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTeamData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#30313A] dark:bg-[#15161C] dark:text-[#C6C6D0] dark:hover:bg-[#202127] dark:shadow-none"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500 dark:text-[#92939E]">
            <Loader2 className="animate-spin" size={22} />
            Loading team dashboard...
          </div>
        ) : (
          <>
            <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Team members" value={members.length} helper="Across accessible projects" icon={Users} tone="blue" />
              <StatCard label="Projects" value={projects.length} helper="Projects you can access" icon={FolderKanban} tone="violet" />
              <StatCard label="Assigned tasks" value={assignedTasks.length} helper="Tasks with an assignee" icon={BriefcaseBusiness} tone="blue" />
              <StatCard label="Completed tasks" value={completedTasks.length} helper="Across accessible projects" icon={CheckCircle2} tone="green" />
              <StatCard label="Overdue tasks" value={overdueTasks.length} helper="Open tasks past due date" icon={AlertTriangle} tone="red" />
            </section>

            <section className="mb-7 grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#292A32] dark:bg-[#15161C] dark:shadow-none">
                <div className="mb-4">
                  <h2 className="font-bold text-slate-900 dark:text-[#C6C6D0]">Task status overview</h2>
                  <p className="text-sm text-slate-500 dark:text-[#92939E]">Tasks across your accessible projects</p>
                </div>
                {[
                  { label: "To Do", count: tasks.filter((task) => task.status === "TODO").length, color: "bg-slate-400" },
                  { label: "In Progress", count: tasks.filter((task) => task.status === "IN_PROGRESS").length, color: "bg-[#8980FF]" },
                  { label: "Completed", count: completedTasks.length, color: "bg-green-500" }
                ].map((item) => (
                  <div key={item.label} className="mb-4 last:mb-0">
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-[#A5A6B0]">{item.label}</span>
                      <span className="font-semibold text-slate-800 dark:text-[#C6C6D0]">{item.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#24252B]">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${tasks.length ? (item.count / tasks.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#292A32] dark:bg-[#15161C] dark:shadow-none">
                <div className="mb-4">
                  <h2 className="font-bold text-slate-900 dark:text-[#C6C6D0]">Workload distribution</h2>
                  <p className="text-sm text-slate-500 dark:text-[#92939E]">Open tasks assigned to each member</p>
                </div>
                {members.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-[#92939E]">No team members found yet.</p>
                ) : (
                  <div className="space-y-3">
                    {members
                      .map((member) => ({
                        ...member,
                        openCount: tasks.filter(
                          (task) => task.assigneeId === member.id && task.status !== "COMPLETED"
                        ).length
                      }))
                      .sort((a, b) => b.openCount - a.openCount)
                      .slice(0, 6)
                      .map((member) => (
                        <div key={member.id}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium text-slate-700 dark:text-[#C6C6D0]">{member.name}</span>
                            <span className="text-slate-500 dark:text-[#92939E]">{member.openCount} open</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#24252B]">
                            <div
                              className="h-full rounded-full bg-[#7068FF]"
                              style={{ width: `${(member.openCount / maxWorkload) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#292A32] dark:bg-[#15161C] dark:shadow-none">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-[#C6C6D0]">Team members</h2>
                  <p className="text-sm text-slate-500 dark:text-[#92939E]">Member performance and project participation</p>
                </div>
                <span className="rounded-full border border-[#7068FF]/20 bg-[#F1EDFF] px-3 py-1 text-xs font-semibold text-[#6258D8] dark:bg-[#24212F] dark:text-[#B2ACFF]">
                  {filteredMembers.length} members
                </span>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="relative md:col-span-1">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#777984]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or email..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#7068FF] focus:ring-2 focus:ring-[#7068FF]/15 dark:border-[#30313A] dark:bg-[#101116] dark:text-[#C6C6D0] dark:placeholder:text-[#777984]"
                  />
                </div>
                <select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#7068FF] dark:border-[#30313A] dark:bg-[#101116] dark:text-[#C6C6D0]"
                >
                  <option value="all">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#7068FF] dark:border-[#30313A] dark:bg-[#101116] dark:text-[#C6C6D0]"
                >
                  <option value="workload">Sort: Highest open workload</option>
                  <option value="completion">Sort: Highest completion rate</option>
                  <option value="name">Sort: Name A–Z</option>
                </select>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-[#30313A]">
                  <Users className="mx-auto mb-2 text-slate-300 dark:text-[#555660]" size={30} />
                  <p className="font-medium text-slate-700 dark:text-[#C6C6D0]">No team members found</p>
                  <p className="mt-1 text-sm text-slate-400">Try changing your search or project filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredMembers.map((member) => {
                    const memberTasks = tasks.filter((task) => task.assigneeId === member.id);
                    const done = memberTasks.filter((task) => task.status === "COMPLETED").length;
                    const open = memberTasks.length - done;
                    const overdue = memberTasks.filter(
                      (task) =>
                        task.status !== "COMPLETED" &&
                        task.dueDate &&
                        new Date(task.dueDate) < today
                    ).length;
                    const completion = memberTasks.length
                      ? Math.round((done / memberTasks.length) * 100)
                      : 0;

                    return (
                      <article key={member.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-[#30313A] dark:bg-[#111217] dark:hover:border-[#50515C] dark:hover:bg-[#14151B] dark:hover:shadow-none">
                        <div className="mb-4 flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-bold text-slate-700 dark:border-[#3A3B43] dark:bg-[#202127] dark:text-[#C6C6D0]">
                            {member.name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-slate-900 dark:text-[#C6C6D0]">{member.name}</h3>
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-[#92939E]">
                              <Mail size={12} /> {member.email || "No email"}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-[#24252B] dark:text-[#A5A6B0]">
                            {member.roles.includes("ADMIN") ? "Admin" : "Member"}
                          </span>
                        </div>

                        <div className="mb-3 grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-[#202127]">
                            <p className="text-xs text-slate-500 dark:text-[#92939E]">Assigned</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-[#C6C6D0]">{memberTasks.length}</p>
                          </div>
                          <div className="rounded-lg bg-green-50 p-2.5 dark:bg-green-500/10">
                            <p className="text-xs text-green-700 dark:text-green-400">Completed</p>
                            <p className="text-xl font-bold text-green-700 dark:text-green-400">{done}</p>
                          </div>
                          <div className={`rounded-lg p-2.5 ${overdue ? "bg-red-50 dark:bg-red-500/10" : "bg-amber-50 dark:bg-amber-500/10"}`}>
                            <p className={`text-xs ${overdue ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>Overdue</p>
                            <p className={`text-xl font-bold ${overdue ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>{overdue}</p>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-slate-500 dark:text-[#92939E]">Completion rate</span>
                            <span className="font-semibold text-slate-700 dark:text-[#C6C6D0]">{completion}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#24252B]">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${completion}%` }} />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-[#292A32]">
                          <div className="flex flex-wrap gap-1.5">
                            {member.projects.map((project) => (
                              <span key={project.id} className="rounded-md border border-[#7068FF]/20 bg-[#F1EDFF] px-2 py-1 text-[11px] text-[#6258D8] dark:bg-[#24212F] dark:text-[#B2ACFF]">
                                {project.name}
                              </span>
                            ))}
                            {member.projects.length === 0 && (
                              <span className="text-xs text-slate-400 dark:text-[#777984]">No project memberships found</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-[#92939E]">{open} open tasks</span>
                        </div>

                        {memberTasks.length > 0 && (
                          <details className="mt-3 border-t border-slate-100 pt-3 dark:border-[#292A32]">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-600 transition hover:text-[#7068FF] dark:text-[#A5A6B0] dark:hover:text-[#A49CFF]">
                              View assigned tasks ({memberTasks.length})
                            </summary>
                            <div className="mt-2 space-y-2">
                              {memberTasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between gap-3 text-xs">
                                  <span className="min-w-0 truncate text-slate-700 dark:text-[#C6C6D0]">{task.title}</span>
                                  <span className="shrink-0 text-slate-500 dark:text-[#92939E]">{(task.status || "").replace("_", " ")}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <p className="mt-4 text-xs text-slate-400 dark:text-[#777984]">
              Team statistics include projects and tasks visible to your account. Member performance is based on assigned tasks, not time tracking.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
