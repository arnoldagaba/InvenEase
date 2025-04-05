import { Request, Response, NextFunction } from "express";
// import { StatusCodes } from "http-status-codes";
import rateLimit, { Options } from "express-rate-limit";
import logger from "./logger.ts";

// General limiter for most API requests
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: {
            message: "Too many requests from this IP, please try again after 15 minutes.",
        },
    },
    handler: (req: Request, res: Response, _next: NextFunction, options: Options) => {
        // Optional: Custom logging
        logger.warn(`Rate limit exceeded for ${req.ip}. Path: ${req.path}. Limit: ${options.limit}.`);
        res.status(options.statusCode).send(options.message);
    },
    // store: // Configure Redis/Memcached store here for multi-instance deployments
});

// Stricter limiter specifically for authentication attempts
export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 5, // Limit each IP to 5 login/refresh attempts per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            message: "Too many authentication attempts from this IP, please try again after 10 minutes.",
        },
    },
    skipSuccessfulRequests: true, // Optional: Don't count successful auth requests towards the limit
    handler: (req: Request, res: Response, _next: NextFunction, options: Options) => {
        logger.warn(`Authentication rate limit exceeded for ${req.ip}.`);
        res.status(options.statusCode).send(options.message);
    },
});

// Consider other specific limiters if needed (e.g., for password reset requests)
