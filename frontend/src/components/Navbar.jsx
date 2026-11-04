
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

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-[#7068FF] focus:ring-2 focus:ring-[#7068FF]/20 dark:border-[#30313A] dark:bg-[#101116] dark:text-[#C6C6D0]";

const labelClass =
  "mb-2 block text-sm font-medium text-slate-700 dark:text-[#C6C6D0]";

const primaryButtonClass =
  "rounded-xl border border-[#3A3B43] bg-[#292A32] px-5 py-2.5 text-[#C6C6D0] transition hover:border-[#50515C] hover:bg-[#34353E] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition hover:bg-slate-50 dark:border-[#30313A] dark:text-[#C6C6D0] dark:hover:bg-white/[0.05]";

function Navbar() {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const [theme, setTheme] = useState(
    () => localStorage.getItem("taskpilot-theme") || "dark"
  );

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    projectId: "",
    priority: "MEDIUM",
    dueDate: "",
  });

  const userName = user?.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("taskpilot-theme", theme);
  }, [theme]);

  useEffect(() => {
    setProfileName(user?.name || "");
  }, [user?.name]);

  const getToken = () => localStorage.getItem("token");

  const handleProfileSave = async (avatarUrl) => {
    try {
      setProfileSaving(true);
      setProfileError("");

      const response = await fetch(`${API_URL}/profile/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileName,
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update profile.");
      }

      updateUser({ ...user, ...data.user });
      setShowProfileEditor(false);
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Image must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => handleProfileSave(reader.result);
    reader.readAsDataURL(file);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const fetchNotifications = async () => {
    const currentToken = getToken();
    if (!currentToken) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/notifications`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
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

    fetch(`${API_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user) updateUser({ ...user, ...data.user });
      })
      .catch((error) => console.error("Profile load error:", error));
  }, [token]);

  const fetchProjects = async () => {
    const currentToken = getToken();

    try {
      const response = await fetch(`${API_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
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
          projectId: previous.projectId || projectList[0].id,
        }));
      }
    } catch (error) {
      console.error("Project fetch error:", error);
      setFormError("Could not load projects. Please try again.");
    }
  };

  const openCreateModal = (type) => {
    setModalType(type);
    setShowCreateMenu(false);
    setFormError("");
    setSuccessMessage("");

    if (type === "task") {
      fetchProjects();
    }
  };

  const closeModal = () => {
    setModalType(null);
    setFormError("");
    setSuccessMessage("");
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    const currentToken = getToken();

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
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          name: projectForm.name.trim(),
          description: projectForm.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create project");
      }

      setSuccessMessage("Project created successfully!");

      setProjectForm({
        name: "",
        description: "",
      });

      window.dispatchEvent(new Event("projectsUpdated"));
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    const currentToken = getToken();

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
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            title: taskForm.title.trim(),
            description: taskForm.description.trim(),
            priority: taskForm.priority,
            ...(taskForm.dueDate && {
              dueDate: new Date(
                `${taskForm.dueDate}T00:00:00`
              ).toISOString(),
            }),
          }),
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
        dueDate: "",
      });

      window.dispatchEvent(new Event("tasksUpdated"));
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const markAsRead = async (notificationId) => {
    const currentToken = getToken();

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
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

  const markAllAsRead = async () => {
    const currentToken = getToken();

    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
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

  const deleteNotification = async (notificationId) => {
    const currentToken = getToken();

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
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
      minute: "2-digit",
    });
  };

  const avatar = user?.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt="Profile"
      className="h-10 w-10 rounded-full border border-[#30313A] object-cover"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#3A3B43] bg-[#202127] font-semibold text-[#C6C6D0]">
      {userInitial}
    </div>
  );

  return (
    <>
      <header className="relative z-40 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 dark:border-[#292A32] dark:bg-[#0D0E12]">
        {/* Search */}
        <div className="relative w-80 max-w-[42vw]">
          <Search
            className="absolute left-3 top-3 text-slate-400 dark:text-[#777984]"
            size={19}
          />

          <input
            type="text"
            placeholder="Search anything..."
            aria-label="Search"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#7068FF] focus:ring-2 focus:ring-[#7068FF]/20 dark:border-[#30313A] dark:bg-[#101116] dark:text-[#C6C6D0] dark:placeholder:text-[#777984]"
          />
        </div>

        <div className="flex items-center gap-4 sm:gap-5">
          {/* Create New */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowCreateMenu((previous) => !previous);
                setShowNotifications(false);
                setShowProfileMenu(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:border-[#3A3B43] dark:bg-[#292A32] dark:text-[#C6C6D0] dark:hover:border-[#50515C] dark:hover:bg-[#34353E]"
            >
              <Plus size={17} />
              <span className="hidden sm:inline">Create New</span>
              <ChevronDown size={15} />
            </button>

            {showCreateMenu && (
              <div className="absolute right-0 top-14 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-[#30313A] dark:bg-[#15161B]">
                <button
                  type="button"
                  onClick={() => openCreateModal("project")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-[#C6C6D0] dark:hover:bg-white/[0.05]"
                >
                  <FolderPlus size={17} className="text-slate-400" />
                  Create Project
                </button>

                <button
                  type="button"
                  onClick={() => openCreateModal("task")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-[#C6C6D0] dark:hover:bg-white/[0.05]"
                >
                  <ListPlus size={17} className="text-slate-400" />
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
                setShowProfileMenu(false);
                fetchNotifications();
              }}
              className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-[#92939E] dark:hover:bg-white/[0.05] dark:hover:text-[#E0E0E5]"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-semibold text-white dark:border-[#0D0E12]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 z-50 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#30313A] dark:bg-[#15161B]">
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-[#292A32]">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-[#D0D0D8]">
                      Notifications
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {unreadCount} unread notifications
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-900 dark:text-[#92939E] dark:hover:text-[#E0E0E5]"
                      >
                        <CheckCheck size={15} />
                        Mark all read
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 transition hover:text-slate-700 dark:hover:text-[#E0E0E5]"
                      aria-label="Close notifications"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loading && notifications.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">
                      Loading notifications...
                    </p>
                  ) : notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <Bell
                        size={28}
                        className="mx-auto mb-3 text-slate-300 dark:text-[#555660]"
                      />
                      <p className="text-sm font-medium text-slate-600 dark:text-[#C6C6D0]">
                        No notifications yet
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        You're all caught up!
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 dark:border-[#292A32] dark:hover:bg-white/[0.03] ${
                          !notification.isRead
                            ? "bg-slate-50 dark:bg-white/[0.04]"
                            : ""
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 dark:border-[#3A3B43] dark:bg-[#202127] dark:text-[#C6C6D0]">
                          <ClipboardList size={17} />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              notification.projectId &&
                              notification.taskId
                            ) {
                              setShowNotifications(false);
                              navigate(
                                `/projects/${notification.projectId}`,
                                {
                                  state: {
                                    openTaskId: notification.taskId,
                                  },
                                }
                              );
                            }

                            if (!notification.isRead) {
                              markAsRead(notification.id);
                            }
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-[#D0D0D8]">
                              {notification.title}
                            </p>

                            {!notification.isRead && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8980FF]" />
                            )}
                          </div>

                          <p className="mt-1 text-xs text-slate-500 dark:text-[#92939E]">
                            {notification.message}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            {formatDate(notification.createdAt)}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteNotification(notification.id)}
                          className="self-start text-slate-400 transition hover:text-red-500"
                          title="Delete notification"
                          aria-label="Delete notification"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 p-3 text-center dark:border-[#292A32]">
                  <button
                    type="button"
                    onClick={fetchNotifications}
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-[#92939E] dark:hover:text-[#E0E0E5]"
                  >
                    Refresh notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu((previous) => !previous);
                setShowCreateMenu(false);
                setShowNotifications(false);
              }}
              className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-slate-100 dark:hover:bg-white/[0.05]"
              aria-label="Open profile menu"
              aria-expanded={showProfileMenu}
            >
              {avatar}

              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-slate-800 dark:text-[#D0D0D8]">
                  {userName}
                </p>
                <p className="max-w-36 truncate text-xs text-slate-400">
                  {user?.email || "Signed in"}
                </p>
              </div>

              <ChevronDown
                size={15}
                className="text-slate-500 dark:text-[#92939E]"
              />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-14 z-[70] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-2xl dark:border-[#30313A] dark:bg-[#15161B]">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-[#292A32]">
                  {avatar}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-[#D0D0D8]">
                      {userName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setProfileName(user?.name || "");
                    setProfileError("");
                    setShowProfileEditor(true);
                    setShowProfileMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-[#C6C6D0] dark:hover:bg-white/[0.05]"
                >
                  <UserRound size={17} className="text-slate-400" />
                  Edit profile
                </button>

                <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-700 dark:text-[#C6C6D0]">
                  <span className="flex items-center gap-3">
                    {theme === "dark" ? (
                      <Moon size={17} className="text-slate-400" />
                    ) : (
                      <Sun size={17} className="text-slate-400" />
                    )}
                    Appearance
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setTheme((previous) =>
                        previous === "dark" ? "light" : "dark"
                      )
                    }
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:border-[#3A3B43] dark:bg-[#24252B] dark:text-[#C6C6D0] dark:hover:bg-[#34353E]"
                  >
                    {theme === "dark" ? "Dark" : "Light"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm text-red-500 transition hover:bg-red-50 dark:border-[#292A32] dark:hover:bg-red-500/10"
                >
                  <LogOut size={17} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile Editor */}
      {showProfileEditor && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowProfileEditor(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#30313A] dark:bg-[#15161B]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-[#D0D0D8]">
                Edit profile
              </h2>

              <button
                type="button"
                onClick={() => setShowProfileEditor(false)}
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-[#E0E0E5]"
                aria-label="Close profile editor"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 flex items-center gap-4">
              {avatar}

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-[#30313A] dark:text-[#C6C6D0] dark:hover:bg-white/[0.05]">
                <Camera size={16} />
                Upload avatar
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
            </div>

            <label className={labelClass}>Display name</label>

            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              maxLength={80}
              className={inputClass}
            />

            {profileError && (
              <p className="mt-3 text-sm text-red-500">{profileError}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProfileEditor(false)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={profileSaving}
                onClick={() => handleProfileSave()}
                className={primaryButtonClass}
              >
                {profileSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project / Task Modal */}
      {modalType && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#30313A] dark:bg-[#15161B]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-[#292A32]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 dark:border-[#3A3B43] dark:bg-[#202127] dark:text-[#C6C6D0]">
                  {modalType === "project" ? (
                    <FolderPlus size={21} />
                  ) : (
                    <ListPlus size={21} />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-[#D0D0D8]">
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
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-[#E0E0E5]"
                aria-label="Close modal"
              >
                <X size={22} />
              </button>
            </div>

            {/* Project Form */}
            {modalType === "project" && (
              <form
                onSubmit={handleCreateProject}
                className="space-y-5 p-6"
              >
                <div>
                  <label className={labelClass}>Project Name *</label>

                  <input
                    type="text"
                    value={projectForm.name}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="Enter project name"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>

                  <textarea
                    value={projectForm.description}
                    onChange={(event) =>
                      setProjectForm({
                        ...projectForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Describe your project..."
                    rows={4}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-500">{formError}</p>
                )}

                {successMessage && (
                  <p className="text-sm text-green-600">
                    {successMessage}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={secondaryButtonClass}
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={primaryButtonClass}
                  >
                    {submitting ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>
            )}

            {/* Task Form */}
            {modalType === "task" && (
              <form
                onSubmit={handleCreateTask}
                className="space-y-5 p-6"
              >
                <div>
                  <label className={labelClass}>Task Title *</label>

                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        title: event.target.value,
                      })
                    }
                    placeholder="Enter task title"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>

                  <textarea
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Describe the task..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div>
                  <label className={labelClass}>Project *</label>

                  <select
                    value={taskForm.projectId}
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        projectId: event.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  >
                    <option value="">Select a project</option>

                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>

                  {projects.length === 0 && (
                    <p className="mt-2 text-xs text-slate-400">
                      No projects available. Create a project first.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Priority</label>

                    <select
                      value={taskForm.priority}
                      onChange={(event) =>
                        setTaskForm({
                          ...taskForm,
                          priority: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Due Date</label>

                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(event) =>
                        setTaskForm({
                          ...taskForm,
                          dueDate: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-sm text-red-500">{formError}</p>
                )}

                {successMessage && (
                  <p className="text-sm text-green-600">
                    {successMessage}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={secondaryButtonClass}
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || projects.length === 0}
                    className={primaryButtonClass}
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
