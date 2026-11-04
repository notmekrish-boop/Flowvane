
import { useState, useEffect } from "react";

import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Users,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  CalendarDays
} from "lucide-react";

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

function Dashboard() {
  const { token, user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState(0);
  const [activities, setActivities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setError("");

      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const [projectResponse, taskResponse, analyticsResponse] = await Promise.all([
          fetch(`${API_URL}/projects`, { headers }),
          fetch(`${API_URL}/tasks`, { headers }),
          fetch(`${API_URL}/projects/analytics`, { headers })
        ]);

        const projectResult = await projectResponse.json();
        const taskResult = await taskResponse.json();
        const analyticsResult = await analyticsResponse.json();

        if (!projectResponse.ok) {
          throw new Error(projectResult.message || "Unable to fetch projects.");
        }

        if (!taskResponse.ok) {
          throw new Error(taskResult.message || "Unable to fetch tasks.");
        }

        if (!analyticsResponse.ok) {
          throw new Error(analyticsResult.message || "Unable to fetch analytics.");
        }

        setProjects(projectResult.projects || []);
        setTasks(taskResult.tasks || []);
        setActivities(analyticsResult.activities || []);

        // Count project memberships across all projects
        const memberCount = projectResult.projects.reduce(
          (total, project) => total + (project._count?.members || 0),
          0
        );

        setTeamMembers(memberCount);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  // Calculate statistics
  const completedTasks = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;

  const pendingTasks = tasks.filter(
    (task) => task.status !== "COMPLETED"
  ).length;

  const overdueTasks = tasks.filter(
    (task) =>
      task.status !== "COMPLETED" &&
      task.dueDate &&
      new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))
  ).length;

  const priorityCounts = {
    HIGH: tasks.filter((task) => task.priority === "HIGH").length,
    MEDIUM: tasks.filter((task) => task.priority === "MEDIUM").length,
    LOW: tasks.filter((task) => task.priority === "LOW").length
  };

  const teamProductivity = Object.values(
    tasks.reduce((members, task) => {
      if (!task.assignee) return members;

      const key = task.assignee.id;
      if (!members[key]) {
        members[key] = {
          id: key,
          name: task.assignee.name || task.assignee.email || "Team member",
          total: 0,
          completed: 0
        };
      }

      members[key].total += 1;
      if (task.status === "COMPLETED") members[key].completed += 1;
      return members;
    }, {})
  ).sort((a, b) => b.completed - a.completed || b.total - a.total);

  // Build daily activity trends from persisted task events.
  // A completion is counted only when the activity log records a transition to COMPLETED.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getLastSevenDays = (offsetDays = 0) => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index) - offsetDays);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const createdCount = tasks.filter((task) => {
      const created = new Date(task.createdAt);
      return created >= day && created < nextDay;
    }).length;

    const completedCount = activities.filter((activity) => {
      const eventDate = new Date(activity.createdAt);
      const details = String(activity.details || "");
      const marksCompletion =
        activity.type === "TASK_STATUS_CHANGED" &&
        /→\s*COMPLETED\b/i.test(details);
      return marksCompletion && eventDate >= day && eventDate < nextDay;
    }).length;

    return {
      date: day,
      label: day.toLocaleDateString("en-IN", { weekday: "short" }),
      created: createdCount,
      completed: completedCount
    };
  });

  const weeklyActivity = getLastSevenDays(0);
  const previousWeekActivity = getLastSevenDays(7);
  const completedThisWeek = weeklyActivity.reduce((sum, day) => sum + day.completed, 0);
  const completedPreviousWeek = previousWeekActivity.reduce((sum, day) => sum + day.completed, 0);
  const createdThisWeek = weeklyActivity.reduce((sum, day) => sum + day.created, 0);
  const createdPreviousWeek = previousWeekActivity.reduce((sum, day) => sum + day.created, 0);
  const completionChange = completedThisWeek - completedPreviousWeek;
  const creationChange = createdThisWeek - createdPreviousWeek;
  const maxWeeklyCount = Math.max(
    1,
    ...weeklyActivity.map((day) => Math.max(day.created, day.completed))
  );
  const maxPriorityCount = Math.max(1, ...Object.values(priorityCounts));
  const statusCounts = {
    TODO: tasks.filter((task) => task.status === "TODO").length,
    IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    COMPLETED: completedTasks
  };
  const completionRate = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  const stats = [
    {
      title: "Total Projects",
      value: projects.length,
      change: "Your active projects",
      icon: FolderKanban,
      color: "blue"
    },
    {
      title: "Completed Tasks",
      value: completedTasks,
      change: "Successfully completed",
      icon: CheckCircle2,
      color: "green"
    },
    {
      title: "Pending Tasks",
      value: pendingTasks,
      change: "To Do and In Progress",
      icon: Clock,
      color: "orange"
    },
    {
      title: "Team Members",
      value: teamMembers,
      change: "Across all projects",
      icon: Users,
      color: "purple"
    },
    {
      title: "Overdue Tasks",
      value: overdueTasks,
      change: "Past due and not completed",
      icon: AlertTriangle,
      color: "orange"
    }
  ];

  // Calculate project progress using completed tasks
  const recentProjects = projects.slice(0, 3).map((project) => {
    const projectTasks = tasks.filter(
      (task) => task.projectId === project.id
    );

    const completed = projectTasks.filter(
      (task) => task.status === "COMPLETED"
    ).length;

    const progress = projectTasks.length > 0
      ? Math.round((completed / projectTasks.length) * 100)
      : 0;

    return {
      ...project,
      progress
    };
  });

  const progressColors = [
    "bg-blue-600",
    "bg-purple-600",
    "bg-green-600"
  ];

  // Get five most recently created tasks
  const recentTasks = tasks.slice(0, 5);

  const colors = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600"
  };

  if (loading) {
    return (
      <div className="p-8 text-slate-500">
        Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">

      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Welcome back, {user?.name || "User"}!
        </h1>

        <p className="text-slate-500 mt-2">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >

              <div className="flex justify-between items-center">

                <p className="text-sm text-slate-500">
                  {stat.title}
                </p>

                <div className={`p-3 rounded-xl ${colors[stat.color]}`}>
                  <Icon size={21} />
                </div>

              </div>

              <h2 className="text-3xl font-bold text-slate-800 mt-4">
                {stat.value}
              </h2>

              <p className="text-xs text-slate-400 mt-2">
                {stat.change}
              </p>

            </div>
          );
        })}

      </div>

      {/* ANALYTICS OVERVIEW */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* PRIORITY DISTRIBUTION */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Priority Distribution</h2>
              <p className="text-xs text-slate-400 mt-1">Tasks grouped by priority</p>
            </div>
          </div>

          <div className="space-y-5">
            {[
              { label: "High", key: "HIGH", color: "bg-red-500" },
              { label: "Medium", key: "MEDIUM", color: "bg-orange-500" },
              { label: "Low", key: "LOW", color: "bg-green-500" }
            ].map((item) => (
              <div key={item.key}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-slate-600">{item.label}</span>
                  <span className="text-slate-500">
                    {priorityCounts[item.key]} ({tasks.length
                      ? Math.round((priorityCounts[item.key] / tasks.length) * 100)
                      : 0}%)
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all`}
                    style={{ width: `${(priorityCounts[item.key] / maxPriorityCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* WEEKLY TASK CREATION */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <CalendarDays size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Weekly Activity</h2>
              <p className="text-xs text-slate-400 mt-1">Tasks created in the last 7 days</p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 h-40 pt-3">
            {weeklyActivity.map((day) => (
              <div key={day.date.toISOString()} className="flex-1 h-full flex flex-col items-center justify-end gap-2">
                <span className="text-xs text-slate-500">{day.created}</span>
                <div className="w-full flex items-end justify-center h-28">
                  <div
                    className="w-full max-w-10 bg-blue-500 rounded-t-md transition-all"
                    style={{
                      height: `${day.created === 0 ? 3 : Math.max(8, (day.created / maxWeeklyCount) * 100)}%`
                    }}
                    title={`${day.created} task(s) created`}
                  />
                </div>
                <span className="text-xs text-slate-400">{day.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* PERFORMANCE ANALYTICS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Performance Analytics</h2>
            <p className="text-sm text-slate-400 mt-1">
              Trends calculated from your projects, tasks, and recorded activity.
            </p>
          </div>
          <span className="text-xs text-slate-400">Last 7 days vs previous 7 days</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-sm text-slate-500">Completion rate</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{completionRate}%</p>
            <p className="text-xs text-slate-400 mt-1">{completedTasks} of {tasks.length} tasks completed</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-sm text-slate-500">Completed this week</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{completedThisWeek}</p>
            <p className={`text-xs mt-1 ${completionChange >= 0 ? "text-green-600" : "text-red-600"}`}>
              {completionChange > 0 ? `+${completionChange}` : completionChange} vs previous week ({completedPreviousWeek})
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-sm text-slate-500">Tasks created this week</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{createdThisWeek}</p>
            <p className={`text-xs mt-1 ${creationChange >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              {creationChange > 0 ? `+${creationChange}` : creationChange} vs previous week ({createdPreviousWeek})
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800">Task status breakdown</h3>
            <p className="text-xs text-slate-400 mt-1">Current status of all accessible tasks</p>
            <div className="h-4 flex overflow-hidden rounded-full bg-slate-100 mt-5">
              {[
                { key: "COMPLETED", color: "bg-green-500" },
                { key: "IN_PROGRESS", color: "bg-blue-500" },
                { key: "TODO", color: "bg-slate-300" }
              ].map((item) => (
                <div
                  key={item.key}
                  className={item.color}
                  style={{ width: `${tasks.length ? (statusCounts[item.key] / tasks.length) * 100 : 0}%` }}
                  title={`${item.key.replace("_", " ")}: ${statusCounts[item.key]}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                ["Completed", statusCounts.COMPLETED, "bg-green-500"],
                ["In progress", statusCounts.IN_PROGRESS, "bg-blue-500"],
                ["To do", statusCounts.TODO, "bg-slate-300"]
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <span className="text-slate-500">{label}</span>
                  <strong className="text-slate-800 ml-auto">{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800">Weekly task trends</h3>
            <p className="text-xs text-slate-400 mt-1">Created tasks and recorded completions per day</p>
            <div className="flex items-end justify-between gap-2 h-40 mt-4">
              {weeklyActivity.map((day) => (
                <div key={day.date.toISOString()} className="flex-1 h-full flex flex-col items-center justify-end gap-2 min-w-0">
                  <div className="flex items-end justify-center gap-1 h-28 w-full">
                    <div
                      className="w-3 sm:w-5 rounded-t bg-blue-500"
                      style={{ height: `${day.created ? Math.max(5, (day.created / maxWeeklyCount) * 100) : 2}%` }}
                      title={`${day.created} created`}
                    />
                    <div
                      className="w-3 sm:w-5 rounded-t bg-green-500"
                      style={{ height: `${day.completed ? Math.max(5, (day.completed / maxWeeklyCount) * 100) : 2}%` }}
                      title={`${day.completed} completed`}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{day.label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-blue-500" />Created</span>
              <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-green-500" />Completed</span>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Completion bars use recorded status-change events; missing historical events are not estimated.
            </p>
          </div>
        </div>
      </section>

      {/* TEAM PRODUCTIVITY */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Team Productivity</h2>
            <p className="text-sm text-slate-400 mt-1">Completed and assigned tasks by assignee</p>
          </div>
        </div>

        {teamProductivity.length === 0 ? (
          <p className="text-sm text-slate-400">No assigned tasks to measure yet.</p>
        ) : (
          <div className="space-y-4">
            {teamProductivity.map((member) => (
              <div key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                <div className="sm:w-44 min-w-0">
                  <p className="font-medium text-sm text-slate-700 truncate">{member.name}</p>
                  <p className="text-xs text-slate-400">
                    {member.completed} completed / {member.total} assigned
                  </p>
                </div>
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${member.total ? (member.completed / member.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-600 sm:w-12 sm:text-right">
                  {member.total ? Math.round((member.completed / member.total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projects Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">

        <div className="flex justify-between items-center mb-6">

          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Recent Projects
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Track your ongoing projects
            </p>
          </div>

          <Link
            to="/projects"
            className="text-blue-600 text-sm font-semibold flex items-center gap-1"
          >
            View All
            <ArrowUpRight size={16} />
          </Link>

        </div>

        <div className="space-y-6">

          {recentProjects.map((project, index) => (

            <div key={project.id}>

              <div className="flex justify-between mb-2">

                <div>
                  <h3 className="font-semibold text-slate-700">
                    {project.name}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    {project.description || "No description"}
                  </p>
                </div>

                <span className="text-sm font-semibold text-slate-600">
                  {project.progress}%
                </span>

              </div>

              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">

                <div
                  className={`h-full rounded-full ${progressColors[index]}`}
                  style={{ width: `${project.progress}%` }}
                />

              </div>

            </div>

          ))}

          {recentProjects.length === 0 && (
            <p className="text-sm text-slate-400">
              No projects yet. Create your first project to get started.
            </p>
          )}

        </div>

      </div>

      {/* Recent Tasks */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">

        <h2 className="text-xl font-bold text-slate-800 mb-5">
          Recent Tasks
        </h2>

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="py-3">Task</th>
                <th className="py-3">Project</th>
                <th className="py-3">Priority</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>

            <tbody>

              {recentTasks.map((task) => {

                const priorityColors = {
                  HIGH: "text-red-600 bg-red-50",
                  MEDIUM: "text-orange-600 bg-orange-50",
                  LOW: "text-green-600 bg-green-50"
                };

                const statusColors = {
                  TODO: "text-slate-600 bg-slate-100",
                  IN_PROGRESS: "text-blue-600 bg-blue-50",
                  COMPLETED: "text-green-600 bg-green-50"
                };

                const statusLabels = {
                  TODO: "To Do",
                  IN_PROGRESS: "In Progress",
                  COMPLETED: "Completed"
                };

                return (
                  <tr
                    key={task.id}
                    className="border-b border-slate-50 text-sm"
                  >

                    <td className="py-4 font-medium text-slate-700">
                      {task.title}
                    </td>

                    <td className="py-4 text-slate-500">
                      {task.project?.name || "Unknown"}
                    </td>

                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${priorityColors[task.priority] || ""}`}>
                        {task.priority}
                      </span>
                    </td>

                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[task.status] || ""}`}>
                        {statusLabels[task.status] || task.status}
                      </span>
                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

          {recentTasks.length === 0 && (
            <p className="text-sm text-slate-400 py-5">
              No tasks created yet.
            </p>
          )}

        </div>

      </div>

    </div>
  );
}

export default Dashboard;
