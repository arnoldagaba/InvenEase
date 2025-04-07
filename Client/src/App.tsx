import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import { ToastContainer } from "react-toastify";
import { queryClient } from "@/lib/react-query";
import { ThemeProvider, useEffectiveTheme } from "@/providers/ThemeProvider";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { MainLayout } from "@/components/layout/MainLayout";
import { Login } from "@/features/auth/routes/Login";
import { ProtectedRoute } from "@/router/ProtectedRoute";
import { PreventLoggedInAccess } from "./router/PreventLoggedInAccess";

const DashboardPage = () => <PageWrapper title="Dashboard">Dashboard Content</PageWrapper>;
const ProductListPage = () => <PageWrapper title="Products">Product List Content</PageWrapper>;
const NotFoundPage = () => <div>404 Not Found</div>;

// Inner component to access the theme hook after ThemeProvider is mounted
function AppContent() {
    const effectiveTheme = useEffectiveTheme(); // Use the hook here

    return (
        <>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route
                        path="/login"
                        element={
                            <PreventLoggedInAccess>
                                <Login />
                            </PreventLoggedInAccess>
                        }
                    />
                    {/* Protected Routes (Wrap with ProtectedRoute component later) */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <MainLayout>
                                    <DashboardPage />
                                </MainLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/products"
                        element={
                            <ProtectedRoute>
                                <MainLayout>
                                    <ProductListPage />
                                </MainLayout>
                            </ProtectedRoute>
                        }
                    />
                    {/* Add routes for Categories, Locations, etc. within MainLayout */}
                    {/* Catch-all 404 */}
                    <Route path="*" element={<NotFoundPage />} /> {/* Consider if 404 needs layout */}
                </Routes>
            </Router>

            <ToastContainer
                position="bottom-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme={effectiveTheme}
            />
        </>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}

export default App;
