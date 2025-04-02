import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import logger from "@/config/logger.ts";
import { ApiError, AuthenticationError, ForbiddenError } from "@/errors/index.ts";

/**
 * Global error handling middleware.
 * Catches errors passed via next(error) and sends appropriate JSON responses.
 * Should be the last middleware added in the Express app setup.
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
    // Default error details
    let statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR;
    let message: string = "An unexpected internal server error occurred.";
    let details: unknown | null = null; // For validation errors or specific details

    // --- Log the error regardless of type ---
    // Log different levels based on error type (e.g., warn for client errors, error for server errors)
    if (err instanceof ApiError && !(err instanceof AuthenticationError) && !(err instanceof ForbiddenError)) {
        // Log client-side predictable errors (NotFound, BadRequest, Conflict) as warnings
        logger.warn(`API Error (${err.name}): ${err.message}`, {
            statusCode: err.statusCode,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            // Avoid logging sensitive data from body/query/params unless necessary and sanitized
        });
    } else {
        // Log authentication/authorization issues or unexpected server errors as errors
        logger.error(`Unhandled Exception or Critical Error: ${err.message}`, {
            name: err.name,
            stack: err.stack, // Include stack trace for debugging server errors
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userId: req.user?.userId,
        });
    }

    // --- Determine Response based on Error Type ---

    // 1. Handle Custom API Errors (Your specific classes extending ApiError)
    if (err instanceof ApiError) {
        statusCode = err.statusCode; // Use the status code defined in the custom error
        message = err.message;
    }
    // 2. Handle Zod Validation Errors
    else if (err instanceof ZodError) {
        statusCode = StatusCodes.BAD_REQUEST;
        message = "Validation failed.";
        // Format Zod errors into a more user-friendly structure
        details = err.errors.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
            code: issue.code,
        }));
    }
    // 3. Handle Generic Errors (Catch-all for unexpected errors)
    else if (err instanceof Error) {
        // Keep default 500 status code
        message = "An internal server error occurred.";
        // Avoid leaking stack traces or sensitive details in production environments
        if (process.env.NODE_ENV !== "production") {
            details = {
                stack: err.stack, // Only include stack in development
                errorName: err.name,
            };
        }
    }
    //TODO: You could add checks for specific errors from libraries like Prisma (e.g., PrismaClientKnownRequestError) if needed

    // --- Send the Response ---
    // Check if headers have already been sent (e.g., if error occurs during streaming)
    if (res.headersSent) {
        return next(err); // Delegate to default Express error handler if headers are sent
    }

    res.status(statusCode).json({
        error: {
            message: message,
            ...(details && typeof details === "object" ? { details } : {}), // Conditionally add details if they exist and are an object
        },
        timestamp: new Date().toISOString(),
    });
};
