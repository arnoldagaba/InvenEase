import { SidebarIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

const menu = [
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
    { name: "Orders", path: "/orders" },
];

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(true);
    const location = useLocation();

    return (
        <aside
            className={`${
                isOpen ? "w-64" : "w-16"
            } bg-white dark:bg-gray-900 shadow transition-all duration-300`}
        >
            <div className="p-4 fle justify-between items-center">
                <button className="text-gray-800 dark:text-gray-100" onClick={() => setIsOpen(!isOpen)}>
                    <SidebarIcon className="w-6 h-6" />
                </button>
            </div>

            <nav className="mt-4">
                {menu.map((item) => (
                    <Link
                        key={item.name}
                        to={item.path}
                        className={`block py-2 px-4 hover:bg-gray-200 dark:hover:bg-gray-700 ${
                            location.pathname === item.path
                                ? "bg-gray-200 dark:bg-gray-800"
                                : "text-gray-800 dark:text-gray-100"
                        }`}
                    >
                        {isOpen ? item.name : item.name.charAt(0)}
                    </Link>
                ))}
            </nav>
        </aside>
    );
};

export default Sidebar;
