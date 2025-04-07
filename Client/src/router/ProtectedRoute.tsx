import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useIsAuthenticated } from "../store/useAuthStore";

interface ProtectedRouteProps {
    children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const isAuthenticated = useIsAuthenticated();
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to. This allows us to send them along to that page after
        // they login, which is a nicer user experience than dropping them off on the home page.
        console.log("User not authenticated, redirecting to login.");
        return <Navigate to="/login" state={{ from: location }} replace />;
        // `replace` avoids adding the redirect route to history stack
    }

    return <>{children}</>;
}
