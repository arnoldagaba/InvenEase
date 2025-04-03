import { z } from "zod";

const positiveNumberOrZero = z.number().min(0, { message: "Value must be zero or positive" });

// Schema for creating a new product
export const createProductSchema = z.object({
    body: z
        .object({
            sku: z.string().min(1, "SKU cannot be empty").max(100, "SKU too long"),
            name: z.string().min(1, "Product name cannot be empty").max(255),
            description: z.string().max(4096).optional(), // Increased max length
            categoryId: z.string().uuid({ message: "Invalid Category ID format" }).optional(), // Optional relation
            unit: z.string().min(1).max(50).default("pcs"),
            reorderLevel: z.number().int().min(0).default(0),
            costPrice: positiveNumberOrZero.optional().default(0.0),
            sellingPrice: positiveNumberOrZero.optional().default(0.0),
            imageUrl: z.string().url({ message: "Invalid image URL" }).max(1024).optional(),
        })
        .strict(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>["body"];

// Schema for updating an existing product (all fields optional)
export const updateProductSchema = z.object({
    params: z.object({
        id: z.string().uuid({ message: "Invalid product ID format" }),
    }),
    body: z
        .object({
            sku: z.string().min(1).max(100).optional(),
            name: z.string().min(1).max(255).optional(),
            description: z.string().max(4096).nullish(),
            categoryId: z.string().uuid().nullish(), // Allow setting to null or new UUID
            unit: z.string().min(1).max(50).optional(),
            reorderLevel: z.number().int().min(0).optional(),
            costPrice: positiveNumberOrZero.optional(),
            sellingPrice: positiveNumberOrZero.optional(),
            imageUrl: z.string().url().max(1024).nullish(),
        })
        .strict()
        .refine((data) => Object.keys(data).length > 0, {
            message: "At least one field must be provided for update",
        }),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>["body"];

// Schema for validating the product ID in parameters
export const productIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid({ message: "Invalid product ID format" }),
    }),
});
export type ProductIdParamInput = z.infer<typeof productIdParamSchema>["params"];

// Schema for query parameters when getting all products
export const getProductQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            search: z.string().optional(), // Search by name, SKU, description
            categoryId: z.string().uuid().optional(), // Filter by category
            sortBy: z.enum(["name", "sku", "createdAt", "updatedAt", "sellingPrice"]).default("name").optional(),
            sortOrder: z.enum(["asc", "desc"]).default("asc").optional(),
        })
        .strict(),
});
export type GetProductQueryInput = z.infer<typeof getProductQuerySchema>["query"];
