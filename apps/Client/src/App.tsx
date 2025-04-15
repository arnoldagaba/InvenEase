import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
    RouterProvider,
} from "react-router";
import { ToastContainer } from "react-toastify";
import { ThemeProvider } from "@/providers/ThemeProvider";
import MainLayout from "@/components/layout/MainLayout";
import { useThemeStore } from "./store/themeStore";

function App() {
    const { theme } = useThemeStore();

    const router = createBrowserRouter(
        createRoutesFromElements(
            <Route>
                <Route path="/" element={<MainLayout />}>
                    <Route
                        index
                        element={<div className="">Home</div>}
                    />
                </Route>
            </Route>
        )
    );

    return (
        <ThemeProvider>
            <RouterProvider router={router} />
            <ToastContainer theme={theme} />
        </ThemeProvider>
    );
}

export default App;
