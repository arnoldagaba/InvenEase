import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useIsAuthenticated } from "@/store/useAuthStore";

interface ProtectedRouteProps {
    children: ReactNode;
}

export function PreventLoggedInAccess({ children }: ProtectedRouteProps) {
    const isAuthenticated = useIsAuthenticated();
    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}
