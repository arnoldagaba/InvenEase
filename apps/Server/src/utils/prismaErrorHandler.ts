import { StatusCodes } from "http-status-codes";
import {
    PrismaClientKnownRequestError,
    PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import AppError from "./AppError.js";

export function handlePrismaError(error: unknown): AppError | null {
    if (error instanceof PrismaClientKnownRequestError) {
        switch (error.code) {
            case "P2002":
                return new AppError(
                    `Unique constraint failed on field: ${error.meta?.target}`,
                    StatusCodes.CONFLICT
                );
            case "P2025":
                return new AppError(
                    `Record not found: ${error.meta?.cause || "Unkown cause"}`,
                    StatusCodes.NOT_FOUND
                );
            default:
                return new AppError("Database error", StatusCodes.BAD_REQUEST);
        }
    }

    if (error instanceof PrismaClientValidationError) {
        return new AppError(
            `Invalid input: ${error.message}`,
            StatusCodes.UNPROCESSABLE_ENTITY
        );
    }

    return null;
}
