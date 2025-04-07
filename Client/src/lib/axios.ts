import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/useAuthStore";
import { Navigate } from "react-router";

// Get API base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";
// Define the endpoint for refreshing the token
const REFRESH_TOKEN_URL = "/auth/refresh";

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    // Crucial for sending the httpOnly refresh token cookie
    withCredentials: true,
});

// Variable to prevent concurrent refresh attempts (basic locking)
let isRefreshing = false;
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: Error) => void }[] = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Request Interceptor: Add Current Access Token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Response Interceptor: Handle Expired Access Token and Refresh
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Check if it's a 401 error and not a retry already
        // Also exclude the refresh token URL itself to avoid infinite loops if refresh fails
        if (
            error.response?.status === 401 &&
            originalRequest.url !== API_BASE_URL + REFRESH_TOKEN_URL &&
            !originalRequest._retry
        ) {
            if (isRefreshing) {
                // If currently refreshing, queue the original request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((newToken) => {
                        if (originalRequest.headers) {
                            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                        }
                        return axiosInstance(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err); // Propagate the error if refresh fails overall
                    });
            }

            originalRequest._retry = true; // Mark as retry attempt
            isRefreshing = true; // Lock refreshing process

            try {
                console.log("Attempting token refresh...");
                // Make the refresh request (cookies are sent automatically due to withCredentials: true)
                const response = await axiosInstance.post(REFRESH_TOKEN_URL);

                // Assuming the backend returns the new access token in the response data
                // Adjust 'accessToken' based on your actual backend response structure
                const newAccessToken = response.data.accessToken;
                if (!newAccessToken) {
                    throw new Error("New access token not received in refresh response.");
                }

                console.log("Token refresh successful.");
                // Update the token in Zustand store
                useAuthStore.getState().setToken(newAccessToken);

                // Update the header of the original request
                if (originalRequest.headers) {
                    originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
                }

                // Process the queue with the new token
                processQueue(null, newAccessToken);

                // Retry the original request with the new token
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                console.error("Token refresh failed:", refreshError);
                // If refresh fails, clear auth state and likely redirect
                useAuthStore.getState().logout();
                processQueue(refreshError as AxiosError, null); // Reject queued requests

                // Redirect to login page
                if (window.location.pathname !== "/login") {
                    Navigate({ to: "/login", replace: true });
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false; // Unlock refreshing process
            }
        }

        // Handle other errors (log them, show notifications, etc.)
        if (error.response?.status !== 401) {
            console.error("API Error:", error.response?.data || error.message);
        }

        return Promise.reject(error);
    },
);

export default axiosInstance;
