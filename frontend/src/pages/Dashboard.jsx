import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  ListTodo,
  Sparkles,
  TrendingUp,
  Users,
} from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../lib/api.js";

const numberFormat = new Intl.NumberFormat("en-IN");

function Dashboard() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState(0);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData() {
      setLoading(true);
      setError("");

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [projectResponse, taskResponse, analyticsResponse] = await Promise.all([
          fetch(`${API_URL}/projects`, { headers }),
          fetch(`${API_URL}/tasks`, { headers }),
          fetch(`${API_URL}/projects/analytics`, { headers }),
        ]);
        const [projectResult, taskResult, analyticsResult] = await Promise.all([
          projectResponse.json(), taskResponse.json(), analyticsResponse.json(),
        ]);

        if (!projectResponse.ok) throw new Error(projectResult.message || "Unable to fetch projects.");
        if (!taskResponse.ok) throw new Error(taskResult.message || "Unable to fetch tasks.");
        if (!analyticsResponse.ok) throw new Error(analyticsResult.message || "Unable to fetch analytics.");
        if (cancelled) return;

        const nextProjects = projectResult.projects || [];
        setProjects(nextProjects);
        setTasks(taskResult.tasks || []);
        setActivities(analyticsResult.activities || []);
        setTeamMembers(nextProjects.reduce((total, project) => total + (project._count?.members || 0), 0));
      } catch (fetchError) {
        if (!cancelled) setError(fetchError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (token) fetchDashboardData();
    return () => { cancelled = true; };
  }, [token]);

  const today = useMemo(() => new Date(), []);
  const startOfToday = useMemo(() => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [today]);

  const completedTasks = tasks.filter((task) => task.status === "COMPLETED").length;
  const openTasks = tasks.filter((task) => task.status !== "COMPLETED");
  const overdueTasks = openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < startOfToday).length;
  const myTasks = tasks.filter((task) => task.assigneeId === user?.id || task.assignee?.id === user?.id);
  const upcomingTasks = useMemo(() => tasks
    .filter((task) => task.status !== "COMPLETED" && task.dueDate && new Date(task.dueDate) >= startOfToday)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5), [tasks, startOfToday]);

  const priorityCounts = {
    HIGH: tasks.filter((task) => task.priority === "HIGH").length,
    MEDIUM: tasks.filter((task) => task.priority === "MEDIUM").length,
    LOW: tasks.filter((task) => task.priority === "LOW").length,
  };
  const maxPriorityCount = Math.max(1, ...Object.values(priorityCounts));

  const weeklyActivity = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfToday);
    day.setDate(startOfToday.getDate() - (6 - index));
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const created = tasks.filter((task) => {
      const createdAt = new Date(task.createdAt);
      return createdAt >= day && createdAt < nextDay;
    }).length;
    const completed = activities.filter((activity) => {
      const changedAt = new Date(activity.createdAt);
      return activity.type === "TASK_STATUS_CHANGED" && /→\s*COMPLETED\b/i.test(String(activity.details || "")) && changedAt >= day && changedAt < nextDay;
    }).length;
    return { label: day.toLocaleDateString("en-IN", { weekday: "short" }), date: day, created, completed };
  }), [tasks, activities, startOfToday]);

  const maxWeeklyCount = Math.max(1, ...weeklyActivity.map((day) => Math.max(day.created, day.completed)));
  const productivity = Object.values(tasks.reduce((members, task) => {
    if (!task.assignee) return members;
    const id = task.assignee.id;
    if (!members[id]) members[id] = { id, name: task.assignee.name || task.assignee.email || "Team member", total: 0, completed: 0 };
    members[id].total += 1;
    if (task.status === "COMPLETED") members[id].completed += 1;
    return members;
  }, {})).sort((a, b) => b.completed - a.completed || b.total - a.total).slice(0, 4);

  const projectProgress = projects.slice(0, 5).map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const complete = projectTasks.filter((task) => task.status === "COMPLETED").length;
    return { ...project, total: projectTasks.length, progress: projectTasks.length ? Math.round((complete / projectTasks.length) * 100) : 0 };
  });

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderKanban, href: "/projects" },
    { label: "Completed", value: completedTasks, icon: CheckCircle2, href: "/tasks" },
    { label: "Open tasks", value: openTasks.length, icon: Clock, href: "/tasks" },
    { label: "Team members", value: teamMembers, icon: Users, href: "/team" },
    { label: "Overdue", value: overdueTasks, icon: AlertTriangle, href: "/tasks", alert: overdueTasks > 0 },
  ];

  if (loading) {
    return <main className="dashboard-page" aria-busy="true" aria-label="Loading dashboard"><div className="dashboard-loading">Loading your dashboard…</div></main>;
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Project dashboard</h1>
          <p>{today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} <span aria-hidden="true">·</span> Good to see you, {user?.name || "there"}</p>
        </div>
        <div className="dashboard-actions">
          <Link to="/tasks" className="dashboard-action dashboard-action-primary"><ListTodo size={16} /> Open tasks</Link>
          <Link to="/notes" className="dashboard-action"><FileText size={16} /> Notes</Link>
          <Link to="/ai-assistant" className="dashboard-action dashboard-action-icon" aria-label="Open AI assistant" title="Ask AI"><Sparkles size={17} /></Link>
        </div>
      </header>

      {error && <div className="dashboard-error" role="alert">{error}</div>}

      <section className="dashboard-stat-strip" aria-label="Workspace summary">
        {stats.map(({ label, value, icon: Icon, href, alert }) => (
          <Link key={label} to={href} className={`dashboard-stat ${alert ? "is-alert" : ""}`}>
            <span className="dashboard-stat-icon"><Icon size={16} /></span>
            <span className="dashboard-stat-label">{label}</span>
            <strong>{numberFormat.format(value)}</strong>
          </Link>
        ))}
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-column dashboard-column-left">
          <section className="dashboard-panel dashboard-task-panel">
            <div className="dashboard-panel-heading">
              <div><h2>My tasks</h2><p>{myTasks.filter((task) => task.status !== "COMPLETED").length} still open</p></div>
              <Link to="/tasks" className="dashboard-panel-link" aria-label="View all tasks" title="View all tasks"><ArrowUpRight size={17} /></Link>
            </div>
            {myTasks.length ? <ul className="dashboard-task-list">
              {myTasks.slice(0, 5).map((task) => (
                <li key={task.id}>
                  <span className={`dashboard-task-marker ${task.status === "COMPLETED" ? "is-done" : task.priority === "HIGH" ? "is-high" : ""}`} aria-hidden="true" />
                  <div className="dashboard-task-copy"><strong>{task.title}</strong><small>{task.project?.name || "Personal task"}</small></div>
                  <span className={`dashboard-task-state state-${task.status.toLowerCase()}`}>{task.status === "COMPLETED" ? "Done" : task.status === "IN_PROGRESS" ? "Doing" : "To do"}</span>
                </li>
              ))}
            </ul> : <p className="dashboard-empty">No tasks are assigned to you yet.</p>}
          </section>

          <section className="dashboard-panel dashboard-priority-panel">
            <div className="dashboard-panel-heading"><div><h2>Priority mix</h2><p>All active tasks</p></div><TrendingUp size={18} className="dashboard-heading-icon" /></div>
            <div className="dashboard-priorities">
              {[{ label: "High", key: "HIGH", cls: "high" }, { label: "Medium", key: "MEDIUM", cls: "medium" }, { label: "Low", key: "LOW", cls: "low" }].map((item) => (
                <div className="dashboard-priority" key={item.key}>
                  <div><span>{item.label}</span><strong>{priorityCounts[item.key]}</strong></div>
                  <div className="dashboard-meter"><span className={`meter-${item.cls}`} style={{ width: `${(priorityCounts[item.key] / maxPriorityCount) * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <Link to="/tasks" className="dashboard-text-link">Browse tasks <ArrowUpRight size={14} /></Link>
          </section>
        </div>

        <div className="dashboard-column dashboard-column-center">
          <section className="dashboard-panel dashboard-project-panel">
            <div className="dashboard-panel-heading"><div><h2>Projects overview</h2><p>Progress across your active work</p></div><Link to="/projects" className="dashboard-panel-link" aria-label="View projects" title="View projects"><ArrowUpRight size={17} /></Link></div>
            {projectProgress.length ? <div className="dashboard-project-list">
              {projectProgress.map((project, index) => (
                <Link to={`/projects/${project.id}`} className="dashboard-project-row" key={project.id}>
                  <span className={`dashboard-project-mark project-mark-${index % 4}`}><FolderKanban size={17} /></span>
                  <span className="dashboard-project-copy"><strong>{project.name}</strong><small>{project.total} {project.total === 1 ? "task" : "tasks"}</small><span className="dashboard-meter"><span style={{ width: `${project.progress}%` }} /></span></span>
                  <strong className="dashboard-project-percent">{project.progress}%</strong>
                </Link>
              ))}
            </div> : <p className="dashboard-empty">No projects yet. Create one to get started.</p>}
          </section>

          <section className="dashboard-panel dashboard-activity-panel">
            <div className="dashboard-panel-heading"><div><h2>Weekly activity</h2><p>Tasks created and completed</p></div><CalendarDays size={18} className="dashboard-heading-icon" /></div>
            <div className="dashboard-chart" role="img" aria-label="Weekly task activity chart">
              {weeklyActivity.map((day) => (
                <div className="dashboard-chart-day" key={day.date.toISOString()}>
                  <div className="dashboard-chart-bars">
                    <span className="chart-created" style={{ height: `${Math.max(day.created ? 7 : 2, (day.created / maxWeeklyCount) * 100)}%` }} title={`${day.created} created`} />
                    <span className="chart-completed" style={{ height: `${Math.max(day.completed ? 7 : 2, (day.completed / maxWeeklyCount) * 100)}%` }} title={`${day.completed} completed`} />
                  </div>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
            <div className="dashboard-chart-legend"><span><i className="legend-created" />Created</span><span><i className="legend-completed" />Completed</span></div>
          </section>

          <section className="dashboard-panel dashboard-recent-panel">
            <div className="dashboard-panel-heading"><div><h2>Recent tasks</h2><p>Latest work across projects</p></div><Link to="/tasks" className="dashboard-panel-link" aria-label="View recent tasks" title="View recent tasks"><ArrowUpRight size={17} /></Link></div>
            {tasks.length ? <div className="dashboard-recent-list">
              {tasks.slice(0, 5).map((task) => (
                <div className="dashboard-recent-row" key={task.id}><span className={`dashboard-task-marker ${task.status === "COMPLETED" ? "is-done" : ""}`} /><div className="dashboard-task-copy"><strong>{task.title}</strong><small>{task.project?.name || "Project"}</small></div><span className="dashboard-priority-label">{task.priority?.toLowerCase()}</span></div>
              ))}
            </div> : <p className="dashboard-empty">No tasks created yet.</p>}
          </section>
        </div>

        <div className="dashboard-column dashboard-column-right">
          <section className="dashboard-panel dashboard-deadline-panel">
            <div className="dashboard-panel-heading"><div><h2>Upcoming</h2><p>Next deadlines</p></div><CalendarClock size={18} className="dashboard-heading-icon" /></div>
            {upcomingTasks.length ? <ul className="dashboard-upcoming-list">
              {upcomingTasks.map((task) => (
                <li key={task.id}><span className="deadline-date"><strong>{new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric" })}</strong><small>{new Date(task.dueDate).toLocaleDateString("en-IN", { month: "short" })}</small></span><div className="dashboard-task-copy"><strong>{task.title}</strong><small>{task.project?.name || "Project"}</small></div></li>
              ))}
            </ul> : <p className="dashboard-empty">No upcoming deadlines. You’re all caught up.</p>}
            <Link to="/tasks" className="dashboard-text-link">All tasks <ArrowUpRight size={14} /></Link>
          </section>

          <section className="dashboard-panel dashboard-team-panel">
            <div className="dashboard-panel-heading"><div><h2>Team activity</h2><p>Tasks completed by member</p></div><Users size={18} className="dashboard-heading-icon" /></div>
            {productivity.length ? <ul className="dashboard-team-list">
              {productivity.map((member) => (
                <li key={member.id}><span className="dashboard-avatar" aria-hidden="true">{member.name.slice(0, 1).toUpperCase()}</span><div className="dashboard-task-copy"><strong>{member.name}</strong><small>{member.completed} of {member.total} complete</small></div><span className="dashboard-team-count">{member.completed}</span></li>
              ))}
            </ul> : <p className="dashboard-empty">Team task activity will appear here.</p>}
            <Link to="/team" className="dashboard-text-link">Team overview <ArrowUpRight size={14} /></Link>
          </section>

          <section className="dashboard-focus-panel">
            <span className="dashboard-focus-icon"><Sparkles size={17} /></span>
            <h2>Need a hand?</h2>
            <p>Get a project summary or turn an idea into a clear next step.</p>
            <Link to="/ai-assistant">Open AI assistant <ArrowUpRight size={14} /></Link>
          </section>
        </div>
      </div>
    </main>
  );
}

export default Dashboard;
