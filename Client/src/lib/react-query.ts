import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Default staleTime: 0 - Fetches on every mount/window focus
            // Consider setting a default staleTime if appropriate
            // staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: true, // Consider false if updates aren't frequent
            retry: 1, // Retry failed requests once
        },
        mutations: {
            // Default mutation options if needed
        },
    },
});
