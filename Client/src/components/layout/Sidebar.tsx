import { NavLink } from "react-router";
import {
    LayoutDashboard,
    Package,
    Boxes,
    Building2,
    Users,
    Settings,
    Warehouse,
    Truck,
    FileText,
    LucideIcon,
    Layers,
    History,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Define Navigation items structure
interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    // roles?: UserRole[];
}

// List your main navigation items based on your Schema/Features
const mainNavItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/products", label: "Products", icon: Package },
    { href: "/categories", label: "Categories", icon: Boxes },
    { href: "/locations", label: "Locations", icon: Warehouse },
    { href: "/suppliers", label: "Suppliers", icon: Building2 },
    { href: "/purchase-orders", label: "Purchase Orders", icon: Truck },
    { href: "/sales-orders", label: "Sales Orders", icon: FileText },
    { href: "/stock-levels", label: "Stock Levels", icon: Layers }, // Might be redundant if managed via Products/Locations
    { href: "/transactions", label: "Transactions", icon: History }, // Often viewed within Product/Order context
];

// Optional: Separate admin/settings navigation
const settingsNavItems: NavItem[] = [
    { href: "/users", label: "Users", icon: Users /*, roles: ['ADMIN'] */ }, // Example role check placeholder
    { href: "/settings", label: "Settings", icon: Settings },
];

// Active link style
const activeClassName = "bg-primary/10 text-primary font-semibold";
const inactiveClassName = "text-foreground/80 hover:bg-secondary hover:text-foreground";

export function Sidebar() {
    // Add logic here later to filter navItems based on user role from useAuthStore

    return (
        <aside className="hidden lg:flex lg:flex-col fixed top-0 left-0 z-20 h-full w-64 border-r bg-card">
            {/* Logo/Brand Section */}
            <div className="flex h-16 items-center border-b px-6">
                <NavLink to="/" className="flex items-center gap-2 font-semibold">
                    {/* Replace with your Logo SVG or text */}
                    <Package className="h-6 w-6 text-primary" />
                    <span className="">InvenEase IMS Inc.</span>
                </NavLink>
            </div>

            {/* Navigation Section */}
            <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                {/* Main Navigation */}
                <ul className="space-y-1">
                    {mainNavItems.map((item) => (
                        <li key={item.href}>
                            <NavLink
                                to={item.href}
                                end // Important: Prevents matching parent routes (e.g., '/' matching '/products')
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-sm",
                                        isActive ? activeClassName : inactiveClassName,
                                    )
                                }
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>

                {/* Divider */}
                <hr className="my-4 border-border" />

                {/* Settings/Admin Navigation */}
                <ul className="space-y-1">
                    {settingsNavItems.map((item) => (
                        // Add conditional rendering based on roles here if needed
                        <li key={item.href}>
                            <NavLink
                                to={item.href}
                                end
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-sm",
                                        isActive ? activeClassName : inactiveClassName,
                                    )
                                }
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Optional: Sidebar Footer (e.g., logged in user info, collapse button) */}
            <div className="mt-auto border-t p-4"> Footer content </div>
        </aside>
    );
}
