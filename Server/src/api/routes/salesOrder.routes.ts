import { Router } from "express";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { UserRole } from "@prisma/client";

import { salesOrderController } from "@/api/controllers/salesOrder.controller.ts";
import {
    createSalesOrderSchema,
    getSalesOrderQuerySchema,
    salesOrderIdParamSchema,
    updateSalesOrderStatusSchema,
    shipSalesOrderItemSchema,
} from "@/api/validators/salesOrder.validator.ts";

const router = Router();

// --- Sales Order Routes ---

// POST /api/sales-orders - Create an SO (All Authenticated Users? Or restrict?)
router.post(
    "/",
    authenticateToken,
    // authorizeRole([UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN]), // Adjust roles as needed
    validateRequest(createSalesOrderSchema),
    salesOrderController.handleCreateSalesOrder,
);

// GET /api/sales-orders - Get SO list
router.get("/", authenticateToken, validateRequest(getSalesOrderQuerySchema), salesOrderController.handleGetSalesOrders);

// GET /api/sales-orders/:id - Get single SO details
router.get("/:id", authenticateToken, validateRequest(salesOrderIdParamSchema), salesOrderController.handleGetSalesOrderById);

// PATCH /api/sales-orders/:id/status - Update SO status (Admin/Manager)
router.patch(
    "/:id/status",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]), // Status updates might be restricted
    validateRequest(updateSalesOrderStatusSchema),
    salesOrderController.handleUpdateSalesOrderStatus,
);

// POST /api/sales-orders/:salesOrderId/items/:itemId/ship - Ship items for a line item (Staff/Manager/Admin)
router.post(
    "/:salesOrderId/items/:itemId/ship",
    authenticateToken,
    authorizeRole([UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN]),
    validateRequest(shipSalesOrderItemSchema),
    salesOrderController.handleShipSalesOrderItem,
);

// Deletion often handled via CANCELLED status

export default router;
