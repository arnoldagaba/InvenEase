import { StatusCodes } from "http-status-codes";
import { ApiError } from "./ApiError.ts";

export class NotFoundError extends ApiError {
    constructor(message = "Resource Not Found") {
        super(message, StatusCodes.NOT_FOUND);
    }
}
