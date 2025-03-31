import { StatusCodes } from "http-status-codes";
import { ApiError } from "./ApiError.ts";

export class BadRequestError extends ApiError {
    constructor(message = "Bad Request") {
        super(message, StatusCodes.BAD_REQUEST);
    }
}
