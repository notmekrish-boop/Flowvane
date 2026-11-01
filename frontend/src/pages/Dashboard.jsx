
import { useState, useEffect } from "react";

import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Users,
  ArrowUpRight
} from "lucide-react";

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

function Dashboard() {
  const { token, user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState(0);

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

        const [projectResponse, taskResponse] = await Promise.all([
          fetch(`${API_URL}/projects`, { headers }),
          fetch(`${API_URL}/tasks`, { headers })
        ]);

        const projectResult = await projectResponse.json();
        const taskResult = await taskResponse.json();

        if (!projectResponse.ok) {
          throw new Error(projectResult.message || "Unable to fetch projects.");
        }

        if (!taskResponse.ok) {
          throw new Error(taskResult.message || "Unable to fetch tasks.");
        }

        setProjects(projectResult.projects);
        setTasks(taskResult.tasks);

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
