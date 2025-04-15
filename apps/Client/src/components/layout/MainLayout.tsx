import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import Breadcrumbs from "../Breadcrumbs";

const MainLayout = () => {
    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-800">
            <Sidebar />

            <div className="flex flex-col flex-1">
                <Navbar />

                {/* Breadcrumbs moved to the main layout */}
                <div className="px-3 py-2 border-b border-gray-300 dark:border-gray-700">
                    <Breadcrumbs />
                </div>

                <main className="flex-1 p-4">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
