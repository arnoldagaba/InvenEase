import { Link } from "react-router";
import NotificationPopover from "../NotificationPopover";
import ThemeSelector from "../ThemeSelector";

const Navbar = () => {
    return (
        <header className="bg-white dark:bg-gray-900 flex justify-between items-center px-4 py-2 shadow">
            {/* Left Side */}
            <div className="flex items-center space-x-4">
                <Link
                    to="/"
                    className="text-xl font-bold text-gray-800 dark:text-gray-100"
                >
                    InvenEase
                </Link>
            </div>

            {/* Right Side */}
            <div className="flex items-center-safe space-x-2">
                <ThemeSelector />
                <NotificationPopover />
            </div>
        </header>
    );
};

export default Navbar;
