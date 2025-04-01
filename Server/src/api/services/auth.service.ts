// import { User, RefreshToken } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import userService, { SafeUser } from "./user.service.ts";
import { comparePassword } from "@/utils/password.util.ts";
import {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    verifyRefreshToken,
    getRefreshTokenExpiration,
    AccessTokenPayload,
    RefreshTokenPayload,
} from "@/utils/token.util.ts";
import { RegisterUserInput, LoginUserInput /* RequestPasswordResetInput, ResetPasswordInput */ } from "@/api/validators/auth.validator.ts";
import { AuthenticationError, ApiError, NotFoundError } from "@/errors/index.ts";
import { StatusCodes } from "http-status-codes";
// Import your email utility (we'll create a basic version later)
// import { sendPasswordResetEmail } from '../utils/email.util';

class AuthService {
    /**
     * Registers a new user.
     * @param registrationData - Validated user registration input.
     * @returns The newly created user (safe version).
     */
    async register(registrationData: RegisterUserInput): Promise<SafeUser> {
        const newUser = await userService.createUser(registrationData);

        // Optional: Send a welcome email (implement email util later)
        // await sendWelcomeEmail(newUser.email, newUser.firstName);

        return newUser;
    }

    /**
     * Authenticates a user and provides tokens.
     * @param loginData - Validated user login input.
     * @returns Access token, Refresh token, and SafeUser data.
     * @throws {AuthenticationError} For invalid credentials or inactive user.
     * @throws {ApiError} For internal errors during token generation/saving.
     */
    async login(loginData: LoginUserInput): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
        const { email, password } = loginData;

        // 1. Find user by email
        const user = await userService.findUserByEmail(email);
        if (!user) {
            throw new AuthenticationError("Invalid email or password."); // Generic message for security
        }

        // 2. Check if user is active
        if (!user.isActive) {
            throw new AuthenticationError("User account is inactive. Please contact support.");
        }

        // 3. Compare password
        const isPasswordValid = await comparePassword(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AuthenticationError("Invalid email or password.");
        }

        // 4. Generate Tokens
        const accessTokenPayload: AccessTokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        const refreshTokenPayload: RefreshTokenPayload = {
            userId: user.id,
            // Add a version or jti if needed for more advanced revocation
        };

        const accessToken = generateAccessToken(accessTokenPayload);
        const refreshToken = generateRefreshToken(refreshTokenPayload); // This is the raw token

        // 5. Hash and Store Refresh Token
        const hashedRefreshToken = hashToken(refreshToken);
        const refreshTokenExpiry = getRefreshTokenExpiration();

        try {
            await this.saveRefreshToken(user.id, hashedRefreshToken, refreshTokenExpiry);
        } catch (error) {
            console.error("Failed to save refresh token:", error);
            throw new ApiError("Login failed: Could not save session.", StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // 6. Prepare safe user data to return
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...safeUserData } = user;

        return {
            accessToken,
            refreshToken, // Send the raw refresh token back to the client (usually in a cookie)
            user: safeUserData,
        };
    }

    /**
     * Saves or updates a refresh token for a user.
     * It's often better to delete old tokens and insert a new one per login
     * for simplicity, but this example upserts. Consider your session strategy.
     * @param userId - The ID of the user.
     * @param tokenHash - The hashed refresh token.
     * @param expiresAt - The expiration date of the token.
     */
    private async saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
        // Strategy: Invalidate old tokens for the user (optional but recommended for security)
        await prisma.refreshToken.updateMany({
            where: {
                userId: userId,
                revoked: false, // Only revoke active tokens
            },
            data: {
                revoked: true,
            },
        });

        // Store the new token
        await prisma.refreshToken.create({
            data: {
                userId,
                tokenHash,
                expiresAt,
                revoked: false,
            },
        });
        // --- OR ---
        // Upsert approach (simpler but might keep old tokens if not cleaned up)
        //   await prisma.refreshToken.upsert({
        //     where: { userId: userId }, // This assumes one active token per user - adjust if multiple sessions allowed
        //     update: { tokenHash, expiresAt, revoked: false, createdAt: new Date() }, // Ensure createdAt updates on replace
        //     create: { userId, tokenHash, expiresAt, revoked: false },
        //   });
    }

    /**
     * Generates a new access token using a valid refresh token.
     * @param providedRefreshToken - The raw refresh token provided by the client.
     * @returns A new access token.
     * @throws {AuthenticationError} If the refresh token is invalid, expired, or revoked.
     * @throws {NotFoundError} If the user associated with the token doesn't exist.
     */
    async refreshAccessToken(providedRefreshToken: string): Promise<{ accessToken: string }> {
        // 1. Verify the JWT structure and signature (without checking DB yet)
        let payload: RefreshTokenPayload;
        try {
            payload = verifyRefreshToken(providedRefreshToken);
        } catch (error) {
            // Catches expired or malformed JWTs from token.util
            if (error instanceof ApiError && error.statusCode === StatusCodes.UNAUTHORIZED) {
                throw new AuthenticationError(error.message); // More specific error
            }
            throw new AuthenticationError("Invalid refresh token."); // Generic fallback
        }

        const { userId } = payload;

        // 2. Hash the provided token to match the one in the DB
        const hashedRefreshToken = hashToken(providedRefreshToken);

        // 3. Find the token in the database
        const storedToken = await prisma.refreshToken.findUnique({
            where: { tokenHash: hashedRefreshToken },
            include: { user: true }, // Include user data to generate new access token
        });

        // 4. Validate the stored token
        if (!storedToken) {
            throw new AuthenticationError("Refresh token not found.");
        }
        if (storedToken.revoked) {
            // Security measure: If a revoked token is used, potentially revoke ALL tokens for that user
            // await this.revokeAllUserTokens(userId);
            throw new AuthenticationError("Refresh token has been revoked.");
        }
        if (new Date() > storedToken.expiresAt) {
            throw new AuthenticationError("Refresh token has expired.");
        }
        if (!storedToken.user) {
            // Should not happen due to schema constraints, but good check
            throw new NotFoundError(`User associated with refresh token not found (ID: ${userId}).`);
        }
        if (!storedToken.user.isActive) {
            throw new AuthenticationError("User account is inactive.");
        }

        // 5. Generate a new Access Token
        const newAccessTokenPayload: AccessTokenPayload = {
            userId: storedToken.user.id,
            email: storedToken.user.email,
            role: storedToken.user.role,
        };
        const newAccessToken = generateAccessToken(newAccessTokenPayload);

        return { accessToken: newAccessToken };
    }

    /**
     * Revokes a specific refresh token (used for logout).
     * @param providedRefreshToken - The raw refresh token to revoke.
     * @returns {Promise<void>}
     * @throws {AuthenticationError} If the token is invalid or not found.
     */
    async logout(providedRefreshToken: string): Promise<void> {
        const hashedRefreshToken = hashToken(providedRefreshToken);

        const updated = await prisma.refreshToken.updateMany({
            where: {
                tokenHash: hashedRefreshToken,
                revoked: false, // Only attempt to revoke active tokens
            },
            data: {
                revoked: true,
            },
        });

        if (updated.count === 0) {
            // Token was already revoked, expired, or never existed.
            // Depending on strictness, could throw error or just ignore.
            // For logout, ignoring might be acceptable.
            console.warn(`Logout attempt with non-existent or already revoked refresh token hash: ${hashedRefreshToken.substring(0, 10)}...`);
            // throw new AuthenticationError('Invalid or already revoked refresh token.');
        }
        console.log(`Refresh token revoked successfully (hash: ${hashedRefreshToken.substring(0, 10)}...)`);
    }

    // --- Password Reset Logic (Implement later) ---
    // async requestPasswordReset(emailData: RequestPasswordResetInput): Promise<void> { ... }
    // async resetPassword(resetData: ResetPasswordInput): Promise<void> { ... }

    // --- Helper to revoke all tokens for a user (Security incident response) ---
    // async revokeAllUserTokens(userId: string): Promise<void> {
    //     await prisma.refreshToken.updateMany({
    //         where: { userId: userId },
    //         data: { revoked: true },
    //     });
    // }
}

export default new AuthService();
