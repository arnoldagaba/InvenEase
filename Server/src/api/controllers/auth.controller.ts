import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import authService from "@/api/services/auth.service.ts";
import { RegisterUserInput, LoginUserInput, ResetPasswordInput, RequestPasswordResetInput } from "@/api/validators/auth.validator.ts";
import { AuthenticationError } from "@/errors/AuthenticationError.ts";

// Cookie options for Refresh Token
const refreshTokenCookieOptions = {
    httpOnly: true, // Prevent client-side JS access
    secure: process.env.NODE_ENV === "production", // Send only over HTTPS in production
    sameSite: "lax" as const, // CSRF protection ('strict' might be too restrictive for some flows)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (should match refresh token expiry) - make dynamic later if needed
    // domain: 'yourdomain.com' // Set domain for production
    path: "/api/auth", // Limit cookie scope if needed
};

class AuthController {
    async register(req: Request<RegisterUserInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            const newUser = await authService.register(req.body);
            res.status(StatusCodes.CREATED).json(newUser);
        } catch (error) {
            next(error); // Pass error to the global error handler
        }
    }

    async login(req: Request<LoginUserInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            const { accessToken, refreshToken, user } = await authService.login(req.body);

            // Set refresh token in HttpOnly cookie
            res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

            // Send access token and user data in response body
            res.status(StatusCodes.OK).json({ accessToken, user });
        } catch (error) {
            next(error);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
        const refreshToken = req.cookies?.refreshToken; // Get token from cookie

        if (!refreshToken) {
            next(new AuthenticationError("Refresh token missing."));
            return;
        }

        try {
            const { accessToken } = await authService.refreshAccessToken(refreshToken);
            res.status(StatusCodes.OK).json({ accessToken });
        } catch (error) {
            // Clear potentially invalid refresh token cookie on failure
            res.clearCookie("refreshToken", refreshTokenCookieOptions);
            next(error);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            console.warn("Logout attempt without refresh token cookie.");
            // A valid access token is still required by the route's middleware to reach here.
            // So, even if the refresh token is missing, we allow the logout process.
            next(new AuthenticationError("Refresh token missing for logout."));
            return;
        }

        try {
            if (refreshToken) {
                await authService.logout(refreshToken);
            }

            // Clear the cookie regardless of whether the service found/revoked the token
            res.clearCookie("refreshToken", refreshTokenCookieOptions);
            res.status(StatusCodes.OK).json({ message: "Logout successful" });
        } catch (error) {
            next(error);
        }
    }

    async handleRequestPasswordReset(req: Request<RequestPasswordResetInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            await authService.requestPasswordReset(req.body);
            // Send a generic success message regardless of whether the user exists
            res.status(StatusCodes.OK).json({ message: "If an account with that email exists, a password reset link has been sent." });
        } catch (error) {
            next(error);
        }
    }

    async handleResetPassword(req: Request<ResetPasswordInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            await authService.resetPassword(req.body);
            res.status(StatusCodes.OK).json({ message: "Password has been reset successfully." });
        } catch (error) {
            next(error);
        }
    }
}

export default new AuthController();
