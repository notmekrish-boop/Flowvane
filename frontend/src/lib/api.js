const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV ? "http://127.0.0.1:5000/api" : "/api";

export const API_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, "");
export const SOCKET_URL = API_URL.replace(/\/api$/i, "");
