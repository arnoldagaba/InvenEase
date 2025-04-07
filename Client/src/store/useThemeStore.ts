import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: "system", // Default theme preference
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: "app-theme", // Key used in localStorage
        },
    ),
);
