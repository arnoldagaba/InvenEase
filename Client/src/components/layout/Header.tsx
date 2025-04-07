import { Sun, Moon, Bell, User } from "lucide-react";
import { useThemeStore } from "@/store/useThemeStore";
import { Button } from "../common/Button";

export function Header() {
    const { theme, setTheme } = useThemeStore();

    const toggleTheme = () => {
        const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
        setTheme(nextTheme);
    };

    return (
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
            {/* Left Section (e.g., Mobile Menu Toggle, Search Bar - Placeholder) */}
            <div>{/* Placeholder for Search or mobile nav trigger */}</div>

            {/* Right Section (Actions) */}
            <div className="flex items-center space-x-4">
                <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                    {/* Using key prop helps React properly transition icons if needed */}
                    {theme === "dark" ? <Sun key="sun" className="h-5 w-5" /> : <Moon key="moon" className="h-5 w-5" />}
                    {/* tooltip or aria-label for accessibility */}
                    <span className="sr-only">Toggle theme ({theme})</span>
                </Button>

                {/* Notification Button - Placeholder */}
                <Button variant="ghost" size="icon" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                    {/* Add badge/indicator for new notifications later */}
                </Button>

                {/* User Menu - Placeholder */}
                {/* Wrap in a Dropdown component later */}
                <Button variant="ghost" size="icon" aria-label="User menu">
                    <User className="h-5 w-5" />
                    <span className="sr-only">User menu</span>
                </Button>
            </div>
        </header>
    );
}
