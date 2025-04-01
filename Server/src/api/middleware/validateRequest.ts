import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { StatusCodes } from "http-status-codes";
import logger from "@/config/logger.ts";

export const validateRequest = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            }));

            res.status(StatusCodes.BAD_REQUEST).json({ error: "Validation failed", details: errorMessages });
            return;
        } else {
            logger.error("Internal server error during validation", { error });
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error during validation" });

            return;
        }
    }
};
