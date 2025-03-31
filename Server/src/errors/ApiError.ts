import { StatusCodes } from "http-status-codes";

export class ApiError extends Error {
    public readonly statusCode: StatusCodes;
    public readonly isOperational: boolean; // Distinguish operational errors from programming errors

    constructor(message: string, statusCode: StatusCodes, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}
