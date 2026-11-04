
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Plus,
  Trash2,
  CheckCheck,
  X,
  ClipboardList,
  FolderPlus,
  ListPlus,
  ChevronDown,
  UserRound,
  Sun,
  Moon,
  LogOut,
  Camera,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

function Navbar() {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create menu and modal states
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [projects, setProjects] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("taskpilot-theme") || "dark");

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: ""
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    projectId: "",
    priority: "MEDIUM",
    dueDate: ""
  });

  const userName = user?.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("taskpilot-theme", theme);
  }, [theme]);

  const handleProfileSave = async (avatarUrl) => {
    try {
      setProfileSaving(true);
      setProfileError("");
      const response = await fetch(`${API_URL}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: profileName, ...(avatarUrl !== undefined ? { avatarUrl } : {}) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update profile.");
      updateUser({ ...user, ...data.user });
      setShowProfileEditor(false);
    } catch (error) { setProfileError(error.message); }
    finally { setProfileSaving(false); }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setProfileError("Choose an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setProfileError("Image must be 2 MB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => handleProfileSave(reader.result);
    reader.readAsDataURL(file);
  };

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  const getToken = () => localStorage.getItem("token");

  // Fetch notifications
  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch notifications");
      }

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Notification fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.user) updateUser({ ...user, ...data.user }); })
      .catch((error) => console.error("Profile load error:", error));
  }, [token]);

  // Fetch projects for task creation
  const fetchProjects = async () => {
    const token = getToken();

    try {
      const response = await fetch(`${API_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch projects");
      }

      const projectList = Array.isArray(data)
        ? data
        : data.projects || [];

      setProjects(projectList);

      if (projectList.length > 0) {
        setTaskForm((previous) => ({
          ...previous,
          projectId: previous.projectId || projectList[0].id
        }));
      }
    } catch (error) {
      console.error("Project fetch error:", error);
      setFormError("Could not load projects. Please try again.");
    }
  };

  // Open create modal
  const openCreateModal = (type) => {
    setModalType(type);
    setShowCreateMenu(false);
    setFormError("");
    setSuccessMessage("");

    if (type === "task") {
      fetchProjects();
    }
  };

  // Close modal
  const closeModal = () => {
    setModalType(null);
    setFormError("");
    setSuccessMessage("");
  };

  // Create project
  const handleCreateProject = async (e) => {
    e.preventDefault();

    const token = getToken();

    if (!projectForm.name.trim()) {
      setFormError("Please enter a project name.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");

      const response = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: projectForm.name.trim(),
          description: projectForm.description.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create project");
      }

      setSuccessMessage("Project created successfully!");

      setProjectForm({
        name: "",
        description: ""
      });

      window.dispatchEvent(new Event("projectsUpdated"));
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Create task
  const handleCreateTask = async (e) => {
    e.preventDefault();

    const token = getToken();

    if (!taskForm.title.trim()) {
      setFormError("Please enter a task title.");
      return;
    }

    if (!taskForm.projectId) {
      setFormError("Please select a project.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");

      const response = await fetch(
        `${API_URL}/tasks/projects/${taskForm.projectId}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: taskForm.title.trim(),
            description: taskForm.description.trim(),
            priority: taskForm.priority,
            ...(taskForm.dueDate && {
              dueDate: new Date(
                `${taskForm.dueDate}T00:00:00`
              ).toISOString()
            })
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create task");
      }

      setSuccessMessage("Task created successfully!");

      setTaskForm({
        title: "",
        description: "",
        projectId: taskForm.projectId,
        priority: "MEDIUM",
        dueDate: ""
      });

      window.dispatchEvent(new Event("tasksUpdated"));
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Mark individual notification as read
  const markAsRead = async (notificationId) => {
    const token = getToken();

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to mark as read");
      }

      await fetchNotifications();
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    const token = getToken();

    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to mark all as read");
      }

      await fetchNotifications();
    } catch (error) {
      console.error("Mark all as read error:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    const token = getToken();

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete notification");
      }

      await fetchNotifications();
    } catch (error) {
      console.error("Delete notification error:", error);
    }
  };

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <>
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between relative z-40">

        {/* Search */}
        <div className="relative w-80">
          <Search
            className="absolute left-3 top-3 text-slate-400"
            size={19}
          />

          <input
            type="text"
            placeholder="Search anything..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-5">

          {/* Create New Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowCreateMenu((previous) => !previous);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition"
            >
              <Plus size={18} />
              Create New
              <ChevronDown size={16} />
            </button>

            {showCreateMenu && (
              <div className="absolute right-0 top-14 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">

                <button
                  type="button"
                  onClick={() => openCreateModal("project")}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                >
                  <FolderPlus size={18} />
                  Create Project
                </button>

                <button
                  type="button"
                  onClick={() => openCreateModal("task")}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                >
                  <ListPlus size={18} />
                  Create Task
                </button>

              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications((previous) => !previous);
                setShowCreateMenu(false);
                fetchNotifications();
              }}
              className="relative text-slate-500 hover:text-blue-600 transition"
              title="Notifications"
            >
              <Bell size={22} />

              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">

                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      Notifications
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {unreadCount} unread notifications
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <CheckCheck size={15} />
                        Mark all read
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loading && notifications.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-10">
                      Loading notifications...
                    </p>
                  ) : notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <Bell
                        size={30}
                        className="mx-auto text-slate-300 mb-3"
                      />
                      <p className="text-sm font-medium text-slate-600">
                        No notifications yet
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        You're all caught up!
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex gap-3 p-4 border-b border-slate-100 hover:bg-slate-50 ${
                          !notification.isRead ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <ClipboardList size={18} />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
  if (notification.projectId && notification.taskId) {
    setShowNotifications(false);

    navigate(`/projects/${notification.projectId}`, {
      state: { openTaskId: notification.taskId }
    });
  }

  if (!notification.isRead) {
    markAsRead(notification.id);
  }
}}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800">
                              {notification.title}
                            </p>

                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full shrink-0" />
                            )}
                          </div>

                          <p className="text-xs text-slate-500 mt-1">
                            {notification.message}
                          </p>

                          <p className="text-xs text-slate-400 mt-2">
                            {formatDate(notification.createdAt)}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteNotification(notification.id)}
                          className="text-slate-400 hover:text-red-500 self-start"
                          title="Delete notification"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 text-center border-t border-slate-200">
                  <button
                    type="button"
                    onClick={fetchNotifications}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Refresh notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button type="button" onClick={() => { setShowProfileMenu((v) => !v); setShowCreateMenu(false); setShowNotifications(false); }} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-slate-100 transition" aria-label="Open profile menu">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">{userInitial}</div>}
              <div className="text-left hidden sm:block"><p className="text-sm font-semibold text-slate-800">{userName}</p><p className="text-xs text-slate-400">{user?.email || "Signed in"}</p></div>
              <ChevronDown size={15} className="text-slate-500" />
            </button>
            {showProfileMenu && <div className="absolute right-0 top-14 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-[70]">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover"/> : <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{userInitial}</div>}<div className="min-w-0"><p className="font-semibold text-sm text-slate-800 truncate">{userName}</p><p className="text-xs text-slate-400 truncate">{user?.email}</p></div></div>
              <button onClick={() => { setProfileName(user?.name || ""); setProfileError(""); setShowProfileEditor(true); setShowProfileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"><UserRound size={17}/>Edit profile</button>
              <div className="px-4 py-3 flex items-center justify-between text-sm text-slate-700"><span className="flex items-center gap-3">{theme === "dark" ? <Moon size={17}/> : <Sun size={17}/>}Appearance</span><button onClick={() => setTheme((v) => v === "dark" ? "light" : "dark")} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{theme === "dark" ? "Dark" : "Light"}</button></div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100"><LogOut size={17}/>Logout</button>
            </div>}
          </div>
        </div>
      </header>

      {/* Profile Editor */}
      {showProfileEditor && <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowProfileEditor(false)}><div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold text-slate-800">Edit profile</h2><button onClick={() => setShowProfileEditor(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button></div><div className="flex items-center gap-4 mb-5">{user?.avatarUrl ? <img src={user.avatarUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover"/> : <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">{userInitial}</div>}<label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Camera size={16}/>Upload avatar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleAvatarChange}/></label></div><label className="block text-sm font-medium text-slate-600 mb-2">Display name</label><input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={80} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"/>{profileError && <p className="text-sm text-red-600 mt-3">{profileError}</p>}<div className="flex justify-end gap-2 mt-6"><button onClick={() => setShowProfileEditor(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={profileSaving} onClick={() => handleProfileSave()} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{profileSaving ? "Saving…" : "Save changes"}</button></div></div></div>}

            {/* Create Project / Task Modal */}
      {modalType && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  {modalType === "project" ? (
                    <FolderPlus size={22} />
                  ) : (
                    <ListPlus size={22} />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {modalType === "project"
                      ? "Create Project"
                      : "Create Task"}
                  </h2>

                  <p className="text-sm text-slate-400">
                    {modalType === "project"
                      ? "Start a new project"
                      : "Add a task to your project"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={22} />
              </button>
            </div>

            {/* Project Form */}
            {modalType === "project" && (
              <form onSubmit={handleCreateProject} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Name *
                  </label>

                  <input
                    type="text"
                    value={projectForm.name}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        name: e.target.value
                      })
                    }
                    placeholder="Enter project name"
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>

                  <textarea
                    value={projectForm.description}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        description: e.target.value
                      })
                    }
                    placeholder="Describe your project..."
                    rows={4}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}

                {successMessage && (
                  <p className="text-sm text-green-600">{successMessage}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>
            )}

            {/* Task Form */}
            {modalType === "task" && (
              <form onSubmit={handleCreateTask} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Task Title *
                  </label>

                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        title: e.target.value
                      })
                    }
                    placeholder="Enter task title"
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>

                  <textarea
                    value={taskForm.description}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        description: e.target.value
                      })
                    }
                    placeholder="Describe the task..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project *
                  </label>

                  <select
                    value={taskForm.projectId}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        projectId: e.target.value
                      })
                    }
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select a project</option>

                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>

                  {projects.length === 0 && (
                    <p className="text-xs text-slate-400 mt-2">
                      No projects available. Create a project first.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Priority
                    </label>

                    <select
                      value={taskForm.priority}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          priority: e.target.value
                        })
                      }
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Due Date
                    </label>

                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          dueDate: e.target.value
                        })
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}

                {successMessage && (
                  <p className="text-sm text-green-600">{successMessage}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || projects.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Task"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
