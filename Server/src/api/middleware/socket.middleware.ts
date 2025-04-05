import { ExtendedError, Socket } from "socket.io";
import { AccessTokenPayload, verifyAccessToken } from "@/utils/token.util.ts";
import { io } from "@/index.ts";
import logger from "@/config/logger.ts";

// Extend Socket type to include user payload after authentication
export interface AuthenticatedSocket extends Socket {
    data: {
        user?: AccessTokenPayload;
    };
}

io.use((socket: AuthenticatedSocket, next: (err?: ExtendedError | undefined) => void) => {
    const token = socket.handshake.auth.token; // Standard way to pass token on connect

    if (!token) {
        logger.warn("Socket connection attempt without token.");
        return next(new Error("Authentication error: Token missing.")); // Send error to client
    }

    try {
        const payload = verifyAccessToken(token);
        // Optional: Could add DB check here for isActive/role changes like in REST auth, but might slow connections.
        // Depends on security requirements vs performance for real-time connections.
        socket.data.user = payload; // Attach user data to socket instance
        logger.debug(`Socket authenticated for user ${payload.userId}`);
        next(); // Proceed with connection
    } catch (error) {
        logger.warn(`Socket authentication failed: ${error instanceof Error ? error.message : String(error)}`);
        return next(new Error("Authentication error: Invalid or expired token."));
    }
});
