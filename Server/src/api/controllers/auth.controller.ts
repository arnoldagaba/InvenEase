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
    /**
     * @route POST /auth/register
     * @group Auth - Authentication operations
     * @param {RegisterUserInput.model} body.body.required - User registration details
     * @returns {SafeUser.model} 201 - User registered successfully
     * @returns {ApiError.model} 400 - Validation failed
     * @returns {ApiError.model} 409 - User already exists
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async register(req: Request<RegisterUserInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            const newUser = await authService.register(req.body);
            res.status(StatusCodes.CREATED).json(newUser);
        } catch (error) {
            next(error); // Pass error to the global error handler
        }
    }

    /**
     * @route POST /auth/login
     * @group Auth - Authentication operations
     * @param {LoginUserInput.model} body.body.required - User login credentials
     * @returns {object} 200 - Login successful
     * @property {string} accessToken - JWT Access Token
     * @property {SafeUser.model} user - User details (excluding password)
     * @returns {ApiError.model} 400 - Validation failed
     * @returns {ApiError.model} 401 - Invalid credentials or inactive user
     * @returns {ApiError.model} 500 - Internal Server Error
     */
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

    /**
     * @route POST /auth/refresh
     * @group Auth - Authentication operations
     * @description Uses the refresh token (sent via HttpOnly cookie) to generate a new access token.
     * @returns {object} 200 - Access token refreshed successfully
     * @property {string} accessToken - New JWT Access Token
     * @returns {ApiError.model} 401 - No refresh token cookie, invalid/expired/revoked token, or inactive user
     * @returns {ApiError.model} 500 - Internal Server Error
     */
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

    /**
     * @route POST /auth/logout
     * @group Auth - Authentication operations
     * @description Revokes the refresh token (sent via HttpOnly cookie) used for the current session. Requires valid Access Token for authorization.
     * @security bearerAuth
     * @returns {object} 200 - Logout successful
     * @property {string} message - Success message
     * @returns {ApiError.model} 401 - No refresh token cookie or invalid access token
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            // Note: Even without a refresh token cookie, we proceed to clear any client-side storage
            // The service layer handles non-existent tokens gracefully.
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
            // Don't clear the cookie here if the service failed unexpectedly,
            // as it might be a server issue, not an invalid token.
            next(error);
        }
    }

    /**
     * @route POST /auth/request-password-reset
     * @group Auth - Authentication operations
     * @param {RequestPasswordResetInput.model} body.body.required - User's email address
     * @returns {object} 200 - Password reset email sent (or request acknowledged)
     * @property {string} message - Confirmation message
     * @returns {ApiError.model} 400 - Validation failed
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async handleRequestPasswordReset(req: Request<RequestPasswordResetInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            await authService.requestPasswordReset(req.body);
            // Send a generic success message regardless of whether the user exists
            res.status(StatusCodes.OK).json({ message: "If an account with that email exists, a password reset link has been sent." });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route POST /auth/reset-password
     * @group Auth - Authentication operations
     * @param {ResetPasswordInput.model} body.body.required - Reset token and new password
     * @returns {object} 200 - Password reset successfully
     * @property {string} message - Success message
     * @returns {ApiError.model} 400 - Validation failed or invalid/expired token
     * @returns {ApiError.model} 500 - Internal Server Error
     */
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
