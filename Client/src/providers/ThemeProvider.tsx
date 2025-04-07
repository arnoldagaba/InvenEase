import { ReactNode, useEffect, useState } from "react";
import { useThemeStore } from "@/store/useThemeStore";

type ThemeProviderProps = {
    children: ReactNode;
};

// Determines the actual theme ('light' or 'dark') based on preference and system setting
const getEffectiveTheme = (themePreference: "light" | "dark" | "system"): "light" | "dark" => {
    if (themePreference === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return themePreference;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
    const themePreference = useThemeStore((state) => state.theme);

    // Effect to apply the theme class to the <html> element
    useEffect(() => {
        const root = window.document.documentElement;
        const effectiveTheme = getEffectiveTheme(themePreference);

        root.classList.remove("light", "dark");
        root.classList.add(effectiveTheme);
    }, [themePreference]);

    // Effect to listen for system preference changes ONLY when 'system' is selected
    useEffect(() => {
        // Only add listener if preference is 'system'
        if (themePreference !== "system") {
            return;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = () => {
            // This handler runs when system theme changes
            const root = window.document.documentElement;
            const newEffectiveTheme = mediaQuery.matches ? "dark" : "light";
            root.classList.remove("light", "dark");
            root.classList.add(newEffectiveTheme);
        };

        mediaQuery.addEventListener("change", handleChange);

        // Cleanup listener when component unmounts or theme preference changes away from 'system'
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [themePreference]); // Re-run this effect if themePreference changes

    return <>{children}</>; // Just render children, no context provider needed
}

// Custom Hook to get the calculated effective theme
export const useEffectiveTheme = (): "light" | "dark" => {
    const themePreference = useThemeStore((state) => state.theme);
    const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() => getEffectiveTheme(themePreference));

    // Update state if preference changes
    useEffect(() => {
        setEffectiveTheme(getEffectiveTheme(themePreference));
    }, [themePreference]);

    // Update state if system preference changes *while* preference is 'system'
    useEffect(() => {
        if (themePreference !== "system") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            setEffectiveTheme(mediaQuery.matches ? "dark" : "light");
        };
        mediaQuery.addEventListener("change", handleChange);

        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [themePreference]);

    return effectiveTheme;
};
