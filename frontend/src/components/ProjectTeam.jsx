import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../lib/api.js";
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  Shield,
  Loader2,
  RefreshCw
} from "./icons";


export default function ProjectTeam({
  projectId,
  canManage = false,
  onAdminLoaded
}) {
  const { token, user } = useAuth();

  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const canManageTeam = canManage || isAdmin;

  async function fetchMembers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/projects/${projectId}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to fetch team members."
        );
      }

      const fetchedMembers = result.members || [];

      setMembers(fetchedMembers);

      const adminStatus = fetchedMembers.some(
        (member) =>
          member.userId === user?.id &&
          member.role === "ADMIN"
      );

      setIsAdmin(adminStatus);
      onAdminLoaded?.(adminStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTeamAnalytics() {
    try {
      setAnalyticsLoading(true);

      const taskResponse = await fetch(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const taskResult = await taskResponse.json();

      if (!taskResponse.ok) {
        throw new Error(taskResult.message || "Unable to load team tasks.");
      }

      const projectTasks = (taskResult.tasks || []).filter(
        (task) => task.projectId === projectId
      );
      setTasks(projectTasks);

      // Fetch activity for the most recently updated tasks to keep requests bounded.
      const recentTasks = [...projectTasks]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 8);

      const activityResults = await Promise.all(
        recentTasks.map(async (task) => {
          try {
            const response = await fetch(
              `${API_URL}/tasks/${task.id}/activities`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const result = await response.json();
            return response.ok ? (result.activities || []) : [];
          } catch {
            return [];
          }
        })
      );

      setActivities(
        activityResults
          .flat()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 12)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    if (projectId && token) {
      fetchMembers();
      fetchTeamAnalytics();
    }
  }, [projectId, token, user?.id]);

  async function handleAddMember(e) {
    e.preventDefault();

    if (!canManageTeam) return;

    if (!email.trim()) {
      setError("Please enter an email address.");
      return;
    }

    try {
      setAdding(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/projects/${projectId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            email: email.trim()
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to add team member."
        );
      }

      setEmail("");
      setSuccess("Team member added successfully.");

      await fetchMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(memberId) {
    if (!canManageTeam) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this team member?"
    );

    if (!confirmed) return;

    try {
      setRemovingId(memberId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/projects/${projectId}/members/${memberId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to remove team member."
        );
      }

      setMembers((current) =>
        current.filter((member) => member.id !== memberId)
      );

      setSuccess("Team member removed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* HEADER */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-100 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <Users size={22} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Project Team
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {canManageTeam
                ? "Manage people working on this project"
                : "People working on this project"}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchMembers();
            fetchTeamAnalytics();
          }}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* ADD MEMBER FORM */}
      {canManageTeam && (
        <form onSubmit={handleAddMember} className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Add a team member
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter registered user's email"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={adding}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adding ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <UserPlus size={17} />
              )}

              {adding ? "Adding..." : "Add Member"}
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Users must already have a registered Flowvane account.
          </p>
        </form>
      )}

      {!canManageTeam && (
        <p className="mb-6 text-xs text-slate-500 dark:text-slate-400">
          Only the project owner or an admin can add or remove team members.
        </p>
      )}

      {/* SUCCESS MESSAGE */}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
          {success}
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* TEAM ANALYTICS */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Team Performance
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Workload, completion and recent team activity for this project
          </p>
        </div>

        {analyticsLoading ? (
          <div className="py-6 text-sm text-slate-500">Loading team analytics...</div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">Total tasks</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{tasks.length}</p>
              </div>
              <div className="rounded-xl bg-green-50 p-4 dark:bg-green-500/10">
                <p className="text-sm text-green-700 dark:text-green-400">Completed</p>
                <p className="mt-1 text-2xl font-bold text-green-800 dark:text-green-300">
                  {tasks.filter((task) => task.status === "COMPLETED").length}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                <p className="text-sm text-amber-700 dark:text-amber-400">Open workload</p>
                <p className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-300">
                  {tasks.filter((task) => task.status !== "COMPLETED").length}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-800 dark:text-white">Member workload</h4>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">All team members</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.userId}>
                      {member.user?.name || member.user?.email || "Team member"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {members
                  .filter((member) =>
                    selectedMemberId === "all" || member.userId === selectedMemberId
                  )
                  .map((member) => {
                    const memberTasks = tasks.filter(
                      (task) => task.assigneeId === member.userId
                    );
                    const completed = memberTasks.filter(
                      (task) => task.status === "COMPLETED"
                    ).length;
                    const open = memberTasks.length - completed;
                    const completion = memberTasks.length
                      ? Math.round((completed / memberTasks.length) * 100)
                      : 0;
                    const workloadLabel =
                      open >= 6 ? "High workload" :
                      open >= 3 ? "Moderate workload" :
                      open > 0 ? "Light workload" : "No open tasks";

                    return (
                      <div
                        key={member.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {member.user?.name || "Unknown User"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {completed} completed · {open} open · {memberTasks.length} assigned
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            open >= 6
                              ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                              : open >= 3
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                              : "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                          }`}>
                            {workloadLabel}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <p className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">
                          {completion}% completed
                        </p>

                        {memberTasks.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                            {memberTasks.map((task) => (
                              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-slate-700 dark:text-slate-300">{task.title}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {task.status.replace("_", " ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {members.length === 0 && (
                  <p className="text-sm text-slate-500">Add team members to see member-wise workload.</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 dark:border-slate-700">
              <h4 className="mb-3 font-semibold text-slate-800 dark:text-white">Recent Team Activity</h4>
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500">No recent activity found for this project's tasks.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 dark:text-slate-200">
                          <span className="font-semibold">{activity.user?.name || "Team member"}</span>
                          {" "}{activity.details}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MEMBER LIST */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-white">
            Team Members
          </h3>

          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
            {members.length} Members
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
            Loading team members...
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
            <Users
              size={32}
              className="mx-auto mb-3 text-slate-400"
            />

            <p className="font-medium text-slate-700 dark:text-slate-300">
              No team members yet
            </p>

            {canManageTeam && (
              <p className="mt-1 text-sm text-slate-500">
                Add someone using their registered email address.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 dark:border-slate-700 dark:hover:border-indigo-500/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400">
                    {member.user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {member.user?.name || "Unknown User"}
                    </p>

                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {member.user?.email || "No email available"}
                    </p>

                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      <Shield size={12} />
                      {member.role}
                    </span>
                  </div>
                </div>

                {canManageTeam && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removingId === member.id}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {removingId === member.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}

                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
