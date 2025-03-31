import { StatusCodes } from "http-status-codes";
import { ApiError } from "./ApiError.ts";

export class ForbiddenError extends ApiError {
    constructor(message = "Access Denied / Forbidden") {
        super(message, StatusCodes.FORBIDDEN); // 403
    }
}
