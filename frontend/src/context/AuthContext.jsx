import { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../lib/api.js";

const AuthContext = createContext();

function tokenExpiresAt(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(window.atob(base64));
    return Number.isFinite(decoded.exp) ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem("token");
    const expiresAt = savedToken ? tokenExpiresAt(savedToken) : null;
    if (savedToken && (!expiresAt || expiresAt <= Date.now())) {
      clearStoredSession();
      return null;
    }
    return savedToken;
  });
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });

  useEffect(() => {
    if (!token) return undefined;
    const expiresAt = tokenExpiresAt(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      clearStoredSession();
      setToken(null);
      setUser(null);
      return undefined;
    }

    const expiryTimer = window.setTimeout(() => {
      clearStoredSession();
      setToken(null);
      setUser(null);
    }, expiresAt - Date.now());
    return () => window.clearTimeout(expiryTimer);
  }, [token]);

  async function authenticate(endpoint, data) {
    const response = await fetch(`${API_URL}/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Authentication failed.");
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    setToken(result.token); setUser(result.user);
    return result;
  }

  function register(name, email, password) { return authenticate("register", { name, email, password }); }
  function login(email, password) { return authenticate("login", { email, password }); }
  function updateUser(nextUser) {
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  }
  function logout() {
    clearStoredSession();
    setToken(null); setUser(null);
  }

  return <AuthContext.Provider value={{ token, user, login, register, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
