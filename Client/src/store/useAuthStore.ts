import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Define the expected User shape received from the backend API
// Adjust based on what your '/api/auth/me' or login response actually sends
export interface User {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role: "ADMIN" | "MANAGER" | "STAFF";
    isActive: boolean;
    // Add any other non-sensitive fields returned by your API
}

interface AuthState {
    user: User | null;
    token: string | null; // Access Token
    isAuthenticated: boolean;
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
    login: (user: User, token: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            // Action to update user info (e.g., after fetching profile)
            setUser: (user) =>
                set((state) => ({
                    user,
                    isAuthenticated: !!user && !!state.token, // Re-evaluate auth status
                })),

            // Action to update only the token (e.g., after refresh)
            setToken: (token) =>
                set((state) => ({
                    token,
                    isAuthenticated: !!state.user && !!token, // Re-evaluate auth status
                })),

            // Convenience action for setting both on initial login
            login: (user, token) => set({ user, token, isAuthenticated: true }),

            // Action to clear everything on logout
            logout: () => set({ user: null, token: null, isAuthenticated: false }),
        }),
        {
            name: "auth-storage", // Key used in storage
            // Consider sessionStorage if tokens shouldn't persist across browser close
            storage: createJSONStorage(() => sessionStorage),
        },
    ),
);

// Selector to easily get authentication status
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
// Selector to get user data
export const useCurrentUser = () => useAuthStore((state) => state.user);
