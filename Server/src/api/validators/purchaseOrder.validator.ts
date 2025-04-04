import { z } from "zod";
import { OrderStatus } from "@prisma/client";

const uuidSchema = z.string().uuid({ message: "Invalid ID format" });
// const positiveNumber = z.number().positive({ message: "Value must be positive" });
const nonNegativeNumber = z.number().min(0, { message: "Value cannot be negative" });

// Schema for individual PO Item when creating a PO
const purchaseOrderItemSchema = z
    .object({
        productId: uuidSchema,
        quantityOrdered: z.number().int().positive({ message: "Quantity ordered must be a positive integer" }),
        unitCost: nonNegativeNumber, // Cost at time of order
    })
    .strict();

// Schema for creating a Purchase Order
export const createPurchaseOrderSchema = z.object({
    body: z
        .object({
            supplierId: uuidSchema,
            orderNumber: z.string().min(1).max(100).optional(), // Make optional if auto-generated
            orderDate: z
                .string()
                .datetime()
                .optional()
                .default(() => new Date().toISOString()),
            expectedDeliveryDate: z.string().datetime().optional(),
            notes: z.string().max(2048).optional(),
            items: z.array(purchaseOrderItemSchema).min(1, { message: "Purchase order must include at least one item" }),
            // status is defaulted in schema, no need to pass usually unless overriding
        })
        .strict(),
});

// Schema for validating PO ID in parameters
export const purchaseOrderIdParamSchema = z.object({
    params: z.object({
        id: uuidSchema,
    }),
});

// Schema for updating PO Status
export const updatePurchaseOrderStatusSchema = z.object({
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
            // Optionally allow adding notes during status update
            notes: z.string().max(2048).optional(),
        })
        .strict(),
});

// Schema for receiving items against a specific PO Item line
export const receivePurchaseOrderItemSchema = z.object({
    params: z.object({
        purchaseOrderId: uuidSchema, // ID of the PO
        itemId: uuidSchema, // ID of the PurchaseOrderItem line
    }),
    body: z
        .object({
            quantityReceived: z.number().int().positive({ message: "Quantity received must be a positive integer" }),
            destinationLocationId: uuidSchema, // Where the stock is being received into
            notes: z.string().max(1024).optional(), // Notes specific to this receipt
        })
        .strict(),
});

// Schema for general PO query parameters
export const getPurchaseOrderQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            supplierId: uuidSchema.optional(),
            userId: uuidSchema.optional(), // User who created it
            status: z.nativeEnum(OrderStatus).optional(),
            orderNumber: z.string().optional(),
            productId: uuidSchema.optional(), // Filter POs containing a specific product
            dateFrom: z.string().datetime().optional(),
            dateTo: z.string().datetime().optional(),
            sortBy: z.enum(["orderDate", "createdAt", "orderNumber"]).default("orderDate").optional(),
            sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
        })
        .strict(),
});

// Type Aliases
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>["body"];
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;
export type PurchaseOrderIdParamInput = z.infer<typeof purchaseOrderIdParamSchema>["params"];
export type UpdatePurchaseOrderStatusInput = z.infer<typeof updatePurchaseOrderStatusSchema>["body"];
export type ReceivePurchaseOrderItemInput = z.infer<typeof receivePurchaseOrderItemSchema>["body"];
export type ReceivePurchaseOrderItemParams = z.infer<typeof receivePurchaseOrderItemSchema>["params"];
export type GetPurchaseOrderQueryInput = z.infer<typeof getPurchaseOrderQuerySchema>["query"];
