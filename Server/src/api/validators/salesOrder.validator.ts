import { z } from "zod";
import { OrderStatus } from "@prisma/client";

const uuidSchema = z.string().uuid({ message: "Invalid ID format" });
// const positiveNumber = z.number().positive({ message: "Value must be positive" });
const nonNegativeNumber = z.number().min(0, { message: "Value cannot be negative" });

// Schema for individual SO Item when creating an SO
const salesOrderItemSchema = z
    .object({
        productId: uuidSchema,
        quantityOrdered: z.number().int().positive({ message: "Quantity ordered must be a positive integer" }),
        unitPrice: nonNegativeNumber, // Price at time of order
    })
    .strict();

// Schema for creating a Sales Order
export const createSalesOrderSchema = z.object({
    body: z
        .object({
            customerRef: z.string().min(1).max(255).optional(), // Simple customer reference
            orderNumber: z.string().min(1).max(100).optional(), // Optional if auto-generated
            orderDate: z
                .string()
                .datetime()
                .optional()
                .default(() => new Date().toISOString()),
            shippingDate: z.string().datetime().optional(), // Estimated or actual
            notes: z.string().max(2048).optional(),
            items: z.array(salesOrderItemSchema).min(1, { message: "Sales order must include at least one item" }),
            // status default handled by Prisma schema
        })
        .strict(),
});

// Schema for validating SO ID in parameters
export const salesOrderIdParamSchema = z.object({
    params: z.object({
        id: uuidSchema,
    }),
});

// Schema for updating SO Status
export const updateSalesOrderStatusSchema = z.object({
    params: z.object({
        id: uuidSchema,
    }),
    body: z
        .object({
            status: z.nativeEnum(OrderStatus, {
                // Validate against Prisma enum
                required_error: "Order status is required",
                invalid_type_error: "Invalid order status provided",
            }),
            // Allow updating shippingDate and notes during status update potentially
            shippingDate: z.string().datetime().optional(),
            notes: z.string().max(2048).optional(),
        })
        .strict()
        .refine((data) => data.status || data.shippingDate || data.notes, {
            message: "At least one field (status, shippingDate, notes) must be provided for update", // Ensure body isn't empty
        }),
});

// Schema for shipping items against a specific SO Item line
export const shipSalesOrderItemSchema = z.object({
    params: z.object({
        salesOrderId: uuidSchema, // ID of the SO
        itemId: uuidSchema, // ID of the SalesOrderItem line
    }),
    body: z
        .object({
            quantityShipped: z.number().int().positive({ message: "Quantity shipped must be a positive integer" }),
            sourceLocationId: uuidSchema, // Where the stock is being shipped FROM
            notes: z.string().max(1024).optional(), // Notes specific to this shipment
        })
        .strict(),
});

// Schema for general SO query parameters
export const getSalesOrderQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            customerRef: z.string().optional(),
            userId: uuidSchema.optional(), // User who created it
            status: z.nativeEnum(OrderStatus).optional(),
            orderNumber: z.string().optional(),
            productId: uuidSchema.optional(), // Filter SOs containing a specific product
            dateFrom: z.string().datetime().optional(),
            dateTo: z.string().datetime().optional(),
            sortBy: z.enum(["orderDate", "createdAt", "orderNumber"]).default("orderDate").optional(),
            sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
        })
        .strict(),
});

// Type Aliases
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>["body"];
export type SalesOrderItemInput = z.infer<typeof salesOrderItemSchema>;
export type SalesOrderIdParamInput = z.infer<typeof salesOrderIdParamSchema>["params"];
export type UpdateSalesOrderStatusInput = z.infer<typeof updateSalesOrderStatusSchema>["body"];
export type ShipSalesOrderItemInput = z.infer<typeof shipSalesOrderItemSchema>["body"];
export type ShipSalesOrderItemParams = z.infer<typeof shipSalesOrderItemSchema>["params"];
export type GetSalesOrderQueryInput = z.infer<typeof getSalesOrderQuerySchema>["query"];
