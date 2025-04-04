import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format" });

// Schema for creating a new supplier
export const createSupplierSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, { message: "Supplier name cannot be empty" }).max(255),
            contactPerson: z.string().max(255).optional(),
            email: z.string().email({ message: "Invalid email format" }).max(255).optional(),
            phone: z.string().max(50).optional(), // Simple validation, might enhance later
            address: z.string().max(2048).optional(),
        })
        .strict(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>["body"];

// Schema for updating an existing supplier
export const updateSupplierSchema = z.object({
    params: z.object({
        id: uuidSchema,
    }),
    body: z
        .object({
            name: z.string().min(1).max(255).optional(),
            contactPerson: z.string().max(255).nullish(), // Allow setting to null
            email: z.string().email().max(255).nullish(),
            phone: z.string().max(50).nullish(),
            address: z.string().max(2048).nullish(),
        })
        .strict()
        .refine((data) => Object.keys(data).length > 0, {
            message: "At least one field must be provided for update",
        }),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>["body"];

// Schema for validating the supplier ID in parameters
export const supplierIdParamSchema = z.object({
    params: z.object({
        id: uuidSchema,
    }),
});
export type SupplierIdParamInput = z.infer<typeof supplierIdParamSchema>["params"];

// Schema for query parameters when getting all suppliers
export const getSupplierQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            search: z.string().optional(), // Search by name, contact, email
            sortBy: z.enum(["name", "createdAt"]).default("name").optional(),
            sortOrder: z.enum(["asc", "desc"]).default("asc").optional(),
        })
        .strict(),
});
export type GetSupplierQueryInput = z.infer<typeof getSupplierQuerySchema>["query"];
