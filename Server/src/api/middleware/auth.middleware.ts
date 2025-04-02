import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { ApiError, AuthenticationError, ForbiddenError } from "@/errors/index.ts";
import { verifyAccessToken, AccessTokenPayload } from "@/utils/token.util.ts";
import userService from "@/api//services/user.service.ts"; // To check if user is active
import logger from "@/config/logger.ts";

// Extend Express Request interface to include 'user' property
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user: AccessTokenPayload;
        }
    }
}

export const authenticateToken = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        next(new AuthenticationError("Authorization header missing or invalid format."));
        return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        next(new AuthenticationError("Access token missing."));
        return;
    }

    try {
        const payload = verifyAccessToken(token);

        // Optional but recommended: Check if the user still exists and is active
        // This hits the DB but prevents using tokens for deleted/inactive users
        // You might cache this check for performance if needed.
        const user = await userService.findUserById(payload.userId); // findUserById throws NotFoundError if not found
        if (!user.isActive) {
            next(new AuthenticationError("User account is inactive."));
            return;
        }
        // Check if role matches the one in token (in case role changed after token issuance)
        if (user.role !== payload.role) {
            // Consider how to handle this - force re-login? or just log it?
            // Forcing re-login is safer.
            next(new AuthenticationError("User role has changed. Please log in again."));
            return;
        }

        // Attach payload to request object for subsequent handlers/controllers
        req.user = payload;
        next(); // Token is valid, proceed to the next middleware/route handler
    } catch (error) {
        // Handle errors from verifyAccessToken (expired, invalid) or userService.findUserById (not found)
        if (error instanceof ApiError) {
            // Pass specific AuthenticationError or NotFoundError
            return next(error);
        }
        // Generic fallback
        return next(new AuthenticationError("Invalid or expired access token."));
    }
};

/**
 * Middleware to authorize requests based on user roles.
 * Must be used *after* authenticateToken middleware.
 * @param allowedRoles - An array of UserRole enums that are allowed to access the route.
 */
export const authorizeRole = (allowedRoles: UserRole[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        // Check if authenticateToken middleware ran successfully and attached user
        if (!req.user || !req.user.role) {
            // This should ideally not happen if authenticateToken is always used before this,
            // but it's a safeguard.
            return next(new AuthenticationError("Authentication required. User role not found."));
        }

        // Check if the user's role is included in the allowed roles
        if (!allowedRoles.includes(req.user.role)) {
            logger.warn(
                `Forbidden access attempt by user ${req.user.userId} (Role: ${req.user.role}) to route requiring roles: ${allowedRoles.join(", ")}`,
            );
            return next(new ForbiddenError("You do not have permission to perform this action."));
        }

        // User has the required role, proceed to the next middleware/handler
        next();
    };
};
