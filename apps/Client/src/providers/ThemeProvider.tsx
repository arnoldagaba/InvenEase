import { ReactNode, useEffect, useState } from "react";
import { useThemeStore, Theme } from "@/store/themeStore";

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * Provides a theme to the application.
 *
 * This component will listen to the {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryListEvent|media query event} for the
 * `prefers-color-scheme` media feature and update the theme accordingly. If the theme is set to `"system"`, the system theme will be used.
 */
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
    const { theme } = useThemeStore();
    const [systemTheme, setSystemTheme] = useState<Theme>(theme);

    // Function to update the theme
    const updateSystemTheme = (e?: MediaQueryListEvent) => {
        const isDark = e
            ? e.matches
            : window.matchMedia("(prefers-color-scheme: dark)").matches;
        setSystemTheme(isDark ? "dark" : "light");
    };

    useEffect(() => {
        // Set initial system theme
        updateSystemTheme();

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        mediaQuery.addEventListener("change", updateSystemTheme);

        return () => {
            mediaQuery.removeEventListener("change", updateSystemTheme);
        };
    }, []);

    const effectiveTheme: Theme = theme === "system" ? systemTheme : theme;

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", effectiveTheme);
    }, [effectiveTheme]);

    return <>{children}</>;
};
