import { StatusCodes } from "http-status-codes";
import { ApiError } from "./ApiError.ts";

export class AuthenticationError extends ApiError {
    constructor(message = "Authentication Failed") {
        super(message, StatusCodes.UNAUTHORIZED); // 401
    }
}
