import prisma from "@/config/prisma.ts";
import userService, { SafeUser } from "./user.service.ts";
import { comparePassword, hashPassword } from "@/utils/password.util.ts";
import {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    verifyRefreshToken,
    getRefreshTokenExpiration,
    AccessTokenPayload,
    RefreshTokenPayload,
    generateResetToken,
} from "@/utils/token.util.ts";
import { RegisterUserInput, LoginUserInput, ResetPasswordInput, RequestPasswordResetInput } from "@/api/validators/auth.validator.ts";
import { AuthenticationError, ApiError, NotFoundError, BadRequestError } from "@/errors/index.ts";
import { StatusCodes } from "http-status-codes";
import { sendPasswordResetConfirmationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "@/utils/email.util.ts";
import logger from "@/config/logger.ts";

class AuthService {
    /**
     * Registers a new user and sends a welcome email.
     * @param registrationData - The registration data for the new user.
     * @returns The created user object (excluding the password hash).
     * @throws {ApiError} If user creation or email sending fails.
     */
    async register(registrationData: RegisterUserInput): Promise<SafeUser> {
        const newUser = await userService.createUser(registrationData);
        await sendWelcomeEmail(newUser.email, newUser.firstName);
        return newUser;
    }

    /**
     * Logs in a user by validating credentials and generating tokens.
     * @param loginData - The login credentials.
     * @returns An object containing access token, refresh token, and user data.
     * @throws {AuthenticationError} If login fails due to invalid credentials or inactive account.
     * @throws {ApiError} If saving the refresh token fails.
     */
    async login(loginData: LoginUserInput): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
        const { email, password } = loginData;
        const user = await userService.findUserByEmail(email);
        if (!user) {
            throw new AuthenticationError("Invalid email or password.");
        }
        if (!user.isActive) {
            throw new AuthenticationError("User account is inactive. Please contact support.");
        }

        const isPasswordValid = await comparePassword(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AuthenticationError("Invalid email or password.");
        }

        const accessTokenPayload: AccessTokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        const refreshTokenPayload: RefreshTokenPayload = {
            userId: user.id,
        };
        const accessToken = generateAccessToken(accessTokenPayload);
        const refreshToken = generateRefreshToken(refreshTokenPayload);
        const hashedRefreshToken = hashToken(refreshToken);
        const refreshTokenExpiry = getRefreshTokenExpiration();

        try {
            await this.saveRefreshToken(user.id, hashedRefreshToken, refreshTokenExpiry);
        } catch (error) {
            console.error("Failed to save refresh token:", error);
            throw new ApiError("Login failed: Could not save session.", StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...safeUserData } = user;
        return {
            accessToken,
            refreshToken,
            user: safeUserData,
        };
    }

    /**
     * Saves a refresh token for a user, invalidating old tokens.
     * @param userId - The ID of the user.
     * @param tokenHash - The hashed refresh token.
     * @param expiresAt - The expiration date of the refresh token.
     */
    private async saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
        await prisma.refreshToken.updateMany({
            where: {
                userId: userId,
                revoked: false,
            },
            data: {
                revoked: true,
            },
        });

        await prisma.refreshToken.create({
            data: {
                userId,
                tokenHash,
                expiresAt,
                revoked: false,
            },
        });
    }

    /**
     * Refreshes an access token using a provided refresh token.
     * @param providedRefreshToken - The refresh token from the client.
     * @returns An object containing a new access token.
     * @throws {AuthenticationError} If the refresh token is invalid or expired.
     */
    async refreshAccessToken(providedRefreshToken: string): Promise<{ accessToken: string }> {
        let payload: RefreshTokenPayload;

        try {
            payload = verifyRefreshToken(providedRefreshToken);
        } catch (error) {
            if (error instanceof ApiError && error.statusCode === StatusCodes.UNAUTHORIZED) {
                throw new AuthenticationError(error.message);
            }
            throw new AuthenticationError("Invalid refresh token.");
        }

        const { userId } = payload;
        const hashedRefreshToken = hashToken(providedRefreshToken);
        const storedToken = await prisma.refreshToken.findUnique({
            where: { tokenHash: hashedRefreshToken },
            include: { user: true },
        });
        if (!storedToken) {
            throw new AuthenticationError("Refresh token not found.");
        }
        if (storedToken.revoked) {
            throw new AuthenticationError("Refresh token has been revoked.");
        }
        if (new Date() > storedToken.expiresAt) {
            throw new AuthenticationError("Refresh token has expired.");
        }
        if (!storedToken.user) {
            throw new NotFoundError(`User associated with refresh token not found (ID: ${userId}).`);
        }
        if (!storedToken.user.isActive) {
            throw new AuthenticationError("User account is inactive.");
        }

        const newAccessTokenPayload: AccessTokenPayload = {
            userId: storedToken.user.id,
            email: storedToken.user.email,
            role: storedToken.user.role,
        };
        const newAccessToken = generateAccessToken(newAccessTokenPayload);
        return { accessToken: newAccessToken };
    }

    /**
     * Logs out a user by revoking their refresh token.
     * @param providedRefreshToken - The refresh token to be revoked.
     */
    async logout(providedRefreshToken: string): Promise<void> {
        const hashedRefreshToken = hashToken(providedRefreshToken);
        const updated = await prisma.refreshToken.updateMany({
            where: {
                tokenHash: hashedRefreshToken,
                revoked: false,
            },
            data: {
                revoked: true,
            },
        });

        if (updated.count === 0) {
            console.warn(`Logout attempt with non-existent or already revoked refresh token hash: ${hashedRefreshToken.substring(0, 10)}...`);
        }
        console.log(`Refresh token revoked successfully (hash: ${hashedRefreshToken.substring(0, 10)}...)`);
    }

    /**
     * Requests a password reset by generating and storing a reset token.
     * @param emailData - The email data containing the user's email.
     */
    async requestPasswordReset(emailData: RequestPasswordResetInput): Promise<void> {
        const { email } = emailData;
        const user = await userService.findUserByEmail(email);
        if (!user) {
            logger.warn(`Password reset requested for non-existent email: ${email}`);
            return;
        }
        if (!user.isActive) {
            logger.warn(`Password reset requested for inactive user: ${email} (ID: ${user.id})`);
            return;
        }

        const { token: rawToken, expires: expiresAt } = generateResetToken();
        const tokenHash = hashToken(rawToken);
        try {
            await prisma.passwordResetToken.deleteMany({
                where: { userId: user.id },
            });
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash: tokenHash,
                    expiresAt: expiresAt,
                },
            });
        } catch (error) {
            logger.error(`Failed to save password reset token for user ${user.id}:`, error);
            throw new ApiError("Could not process password reset request.", StatusCodes.INTERNAL_SERVER_ERROR);
        }
        try {
            await sendPasswordResetEmail(user.email, rawToken, user.firstName);
        } catch {
            logger.error(`Failed to SEND password reset email for user ${user.id}, but token was generated.`);
        }
    }

    /**
     * Resets a user's password using a reset token.
     * @param resetData - The reset data containing the token and new password.
     * @throws {BadRequestError} If the reset token is invalid or expired.
     * @throws {ApiError} If updating the password or sending confirmation email fails.
     */
    async resetPassword(resetData: ResetPasswordInput): Promise<void> {
        const { token: rawToken, newPassword } = resetData;
        const tokenHash = hashToken(rawToken);
        const storedToken = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!storedToken) {
            throw new BadRequestError("Invalid or expired password reset token.");
        }
        if (new Date() > storedToken.expiresAt) {
            await prisma.passwordResetToken.delete({ where: { id: storedToken.id } });
            throw new BadRequestError("Password reset token has expired.");
        }
        if (!storedToken.user) {
            logger.error(`Password reset token ${storedToken.id} has no associated user.`);
            await prisma.passwordResetToken.delete({ where: { id: storedToken.id } });
            throw new BadRequestError("Invalid password reset token.");
        }
        if (!storedToken.user.isActive) {
            logger.warn(`Password reset attempt for inactive user: ${storedToken.user.email} (ID: ${storedToken.userId})`);
            await prisma.passwordResetToken.delete({ where: { id: storedToken.id } });
            throw new BadRequestError("Cannot reset password for an inactive account.");
        }

        let newPasswordHash: string;
        try {
            newPasswordHash = await hashPassword(newPassword);
        } catch (error) {
            logger.error("Password hashing failed during reset:", error);
            throw new ApiError("Failed to process new password.", StatusCodes.INTERNAL_SERVER_ERROR);
        }

        try {
            await prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: storedToken.userId },
                    data: { passwordHash: newPasswordHash },
                });
                await tx.passwordResetToken.delete({
                    where: { id: storedToken.id },
                });
                await tx.refreshToken.updateMany({
                    where: { userId: storedToken.userId, revoked: false },
                    data: { revoked: true },
                });
            });
        } catch (error) {
            logger.error(`Failed transaction during password reset for user ${storedToken.userId}:`, error);
            throw new ApiError("Could not reset password.", StatusCodes.INTERNAL_SERVER_ERROR);
        }

        try {
            await sendPasswordResetConfirmationEmail(storedToken.user.email, storedToken.user.firstName);
        } catch {
            logger.error(`Failed to SEND password reset confirmation email for user ${storedToken.userId}.`);
        }
    }
}

export default new AuthService();
