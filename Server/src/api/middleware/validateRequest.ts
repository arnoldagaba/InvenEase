/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { StatusCodes } from "http-status-codes";
import logger from "@/config/logger.ts";

// Extend Request type to potentially hold validated data
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            // Store validated data separately to avoid complex type merging issues
            validatedData?: {
                body?: any;
                query?: any;
                params?: any;
            };
        }
    }
}

export const validateRequest = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // --- Store the validated and transformed data on the request ---
        req.validatedData = {
            body: parsed.body,
            query: parsed.query,
            params: parsed.params,
        };

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
