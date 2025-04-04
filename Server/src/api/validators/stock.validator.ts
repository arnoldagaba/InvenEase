import { z } from "zod";

export const getStockLevelQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            productId: z.string().uuid().optional(), // Filter by specific product
            locationId: z.string().uuid().optional(), // Filter by specific location
            belowReorder: z.preprocess((val) => String(val).toLowerCase() === "true", z.boolean()).optional(), // Check for low stock items
            //TODO: Add other filters as needed (e.g., quantity greater than, specific SKU search through product relation)
            searchProduct: z.string().optional(), // Search by product name/SKU
        })
        .strict(),
});
export type GetStockLevelQueryInput = z.infer<typeof getStockLevelQuerySchema>["query"];

export const getLowStockQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            locationId: z.string().uuid().optional(), // Optional: Scope low stock to a specific location
        })
        .strict(),
});
export type GetLowStockQueryInput = z.infer<typeof getLowStockQuerySchema>["query"];
