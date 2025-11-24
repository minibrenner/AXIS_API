import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "./config";
import { getAccessToken, clearSession, setAccessToken } from "../auth/session";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();

    if (token) {
      const headers = (config.headers ?? {}) as Record<string, unknown>;
      // garante que o objeto headers de volta para o axios
      config.headers = headers;

      if (!headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = apiClient
    .post<{ access?: string }>("/auth/refresh")
    .then((response) => {
      const access = response.data?.access;
      if (access) {
        setAccessToken(access);
        return access;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Se nao for um erro do Axios ou nao houver config, apenas repassa o erro
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const status = error.response?.status;
    const requestUrl = originalRequest.url ?? "";

    if (
      status === 401 &&
      !originalRequest._retry &&
      requestUrl &&
      !requestUrl.includes("/auth/login") &&
      !requestUrl.includes("/auth/refresh") &&
      !requestUrl.includes("/super-admin")
    ) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();
      if (!newToken) {
        clearSession();
        return Promise.reject(error);
      }

      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  },
);
