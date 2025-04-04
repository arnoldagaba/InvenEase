// src/api/validators/transaction.validator.ts
import { z } from "zod";
import { TransactionType } from "@prisma/client";

const uuidSchema = z.string().uuid({ message: "Invalid ID format" });

// Schema for creating an Adjustment (IN or OUT)
export const createAdjustmentSchema = z.object({
    body: z
        .object({
            productId: uuidSchema,
            locationId: uuidSchema,
            // Positive for IN, Negative for OUT will be handled in service based on type
            quantityChange: z
                .number()
                .int({ message: "Quantity must be an integer" })
                .positive({ message: "Quantity must be positive for adjustment" }), // Input is always positive, service flips based on type
            type: z.enum([TransactionType.ADJUSTMENT_IN, TransactionType.ADJUSTMENT_OUT], {
                required_error: "Adjustment type (ADJUSTMENT_IN or ADJUSTMENT_OUT) is required",
            }),
            notes: z.string().max(1024).optional(),
        })
        .strict(),
});
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>["body"];

// Schema for creating an Inventory Transfer
export const createTransferSchema = z.object({
    body: z
        .object({
            productId: uuidSchema,
            sourceLocationId: uuidSchema,
            destinationLocationId: uuidSchema,
            quantity: z.number().int().positive({ message: "Transfer quantity must be positive" }),
            notes: z.string().max(1024).optional(),
        })
        .strict()
        .refine((data) => data.sourceLocationId !== data.destinationLocationId, {
            message: "Source and destination locations cannot be the same",
            path: ["destinationLocationId"], // Indicate the field related to the error
        }),
});
export type CreateTransferInput = z.infer<typeof createTransferSchema>["body"];

// Schema for query parameters when getting transaction history
export const getTransactionQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            productId: uuidSchema.optional(),
            locationId: uuidSchema.optional(), // Could filter source OR destination
            userId: uuidSchema.optional(), // Filter by user who created transaction
            type: z.nativeEnum(TransactionType).optional(), // Filter by transaction type
            relatedPoId: uuidSchema.optional(),
            relatedSoId: uuidSchema.optional(),
            startDate: z.string().datetime({ message: "Invalid start date format" }).optional(),
            endDate: z.string().datetime({ message: "Invalid end date format" }).optional(),
            sortBy: z.enum(["timestamp", "quantityChange"]).default("timestamp").optional(), // Add more if needed
            sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
        })
        .strict()
        .refine(
            (data) => {
                // Ensure end date is not before start date if both are provided
                if (data.startDate && data.endDate) {
                    return new Date(data.endDate) >= new Date(data.startDate);
                }
                return true;
            },
            { message: "End date cannot be earlier than start date", path: ["endDate"] },
        ),
});
export type GetTransactionQueryInput = z.infer<typeof getTransactionQuerySchema>["query"];
