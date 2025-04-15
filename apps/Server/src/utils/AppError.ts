import { StatusCodes } from "http-status-codes";

export default class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
        isOperational = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
