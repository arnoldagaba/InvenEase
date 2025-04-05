import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format" });

// Schema for querying audit logs
export const getAuditLogQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            userId: uuidSchema.optional(), // Filter by user who performed the action
            action: z.string().optional(), // Filter by specific action code (e.g., 'CREATE_PRODUCT')
            entity: z.string().optional(), // Filter by entity type (e.g., 'Product', 'StockLevel')
            entityId: z.string().optional(), // Filter by specific entity ID (useful when entity is known)
            startDate: z.string().datetime({ message: "Invalid start date format" }).optional(),
            endDate: z.string().datetime({ message: "Invalid end date format" }).optional(),
            // Sort by timestamp is the most common
            sortBy: z.enum(["timestamp"]).default("timestamp").optional(), // Limited useful sorting options usually
            sortOrder: z.enum(["asc", "desc"]).default("desc").optional(), // Show newest first by default
        })
        .strict()
        .refine(
            (data) => {
                if (data.startDate && data.endDate) {
                    return new Date(data.endDate) >= new Date(data.startDate);
                }
                return true;
            },
            { message: "End date cannot be earlier than start date", path: ["endDate"] },
        ),
});

// Type Alias
export type GetAuditLogQueryInput = z.infer<typeof getAuditLogQuerySchema>["query"];
