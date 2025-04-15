import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

interface ThemeStore {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

// Function to get the initial theme from localStorage if available.
const getInitialTheme = (): Theme => {
    if (typeof window !== "undefined") {
        const storedTheme = localStorage.getItem("theme");
        if (
            storedTheme === "light" ||
            storedTheme === "dark" ||
            storedTheme === "system"
        ) {
            return storedTheme;
        }
    }
    return "system";
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
    theme: getInitialTheme(),
    setTheme: (theme: Theme) => {
        // Save the theme selection persistently
        if (typeof window !== "undefined") {
            localStorage.setItem("theme", theme);
        }
        set({ theme });
    },
    toggleTheme: () => {
        const current = get().theme;
        // Cycle theme: light → dark → system → light
        const newTheme: Theme =
            current === "light"
                ? "dark"
                : current === "dark"
                ? "system"
                : "light";
        if (typeof window !== "undefined") {
            localStorage.setItem("theme", newTheme);
        }
        set({ theme: newTheme });
    },
}));
