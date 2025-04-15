import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/store/themeStore";

export default function ThemeSelector() {
    // const theme = useThemeStore((state) => state.theme);
    // const setTheme = useThemeStore((state) => state.setTheme);
    const { theme, setTheme } = useThemeStore();

    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="outline"
                        aria-label="Select theme"
                    >
                        {theme === "light" && (
                            <SunIcon size={16} aria-hidden="true" />
                        )}
                        {theme === "dark" && (
                            <MoonIcon size={16} aria-hidden="true" />
                        )}
                        {theme === "system" && (
                            <MonitorIcon size={16} aria-hidden="true" />
                        )}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="min-w-32">
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                        <SunIcon
                            size={16}
                            className="opacity-60"
                            aria-hidden="true"
                        />
                        <span>Light</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <MoonIcon
                            size={16}
                            className="opacity-60"
                            aria-hidden="true"
                        />
                        <span>Dark</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => setTheme("system")}>
                        <MonitorIcon
                            size={16}
                            className="opacity-60"
                            aria-hidden="true"
                        />
                        <span>System</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
