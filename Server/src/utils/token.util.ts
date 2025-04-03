import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "@/errors/index.ts";
import logger from "@/config/logger.ts";

// --- Configuration (Load from environment variables) ---
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || "your_access_secret";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "your_refresh_secret";
const ACCESS_TOKEN_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || "15m";
const REFRESH_TOKEN_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d";
const RESET_TOKEN_EXPIRATION_MINUTES = parseInt(process.env.RESET_TOKEN_EXPIRATION_MINUTES || "60", 10);

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    logger.warn("JWT secrets are not set in environment variables. Using default secrets.");
}

// --- Types ---
export interface AccessTokenPayload {
    userId: string;
    email: string;
    role: User["role"]; // Use the enum type from Prisma
}

export interface RefreshTokenPayload {
    userId: string;
    // You might add a token version/identifier here for more robust revocation
}

// --- Access Token Functions ---
export const generateAccessToken = (payload: AccessTokenPayload): string => {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRATION as jwt.SignOptions["expiresIn"],
    });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
    try {
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
        return decoded as AccessTokenPayload;
    } catch (error) {
        // Handle specific JWT errors if needed (TokenExpiredError, JsonWebTokenError)
        if (error instanceof jwt.TokenExpiredError) {
            throw new ApiError("Access token expired", StatusCodes.UNAUTHORIZED);
        }
        throw new ApiError("Invalid access token", StatusCodes.UNAUTHORIZED);
    }
};

// --- Refresh Token Functions ---
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRATION as jwt.SignOptions["expiresIn"],
    });
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    try {
        const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new ApiError("Refresh token expired", StatusCodes.UNAUTHORIZED);
        }
        throw new ApiError("Invalid refresh token", StatusCodes.UNAUTHORIZED);
    }
};

// --- Token Hashing (For storing in DB) ---
export const hashToken = (token: string): string => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

// --- Password Reset Token ---
export const generateResetToken = (): { token: string; expires: Date } => {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + RESET_TOKEN_EXPIRATION_MINUTES);
    return { token, expires };
};

export const getRefreshTokenExpiration = (): Date => {
    const now = new Date();
    if (REFRESH_TOKEN_EXPIRATION.endsWith("d")) {
        const days = parseInt(REFRESH_TOKEN_EXPIRATION.replace("d", ""), 10);
        now.setDate(now.getDate() + days);
    } else if (REFRESH_TOKEN_EXPIRATION.endsWith("h")) {
        const hours = parseInt(REFRESH_TOKEN_EXPIRATION.replace("h", ""), 10);
        now.setHours(now.getHours() + hours);
    } //TODO: Add more cases as needed
    else {
        // Default or fallback
        now.setDate(now.getDate() + 7);
    }
    return now;
};
