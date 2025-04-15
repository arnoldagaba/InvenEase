import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import logger from "../config/logger.js";
import AppError from "../utils/AppError.js";
import { handlePrismaError } from "../utils/prismaErrorHandler.js";

export function globalErrorHandler(
    err: any,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    // Convert Prisma errors into AppError
    const prismaHandled = handlePrismaError(err);
    if (prismaHandled) err = prismaHandled;

    if (!(err instanceof AppError)) {
        logger.error("Unexpected error: ", err);
        err = new AppError(
            "An unexpected error occurred",
            StatusCodes.INTERNAL_SERVER_ERROR,
            false
        );
    } else {
        logger.error(err.message);
    }

    const response = {
        status: "error",
        message: err.message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    };

    res.status(err.statusCode).json(response);
}
