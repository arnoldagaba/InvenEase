import { Router } from "express";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { UserRole } from "@prisma/client";

import { purchaseOrderController } from "@/api/controllers/purchaseOrder.controller.ts";
import {
    createPurchaseOrderSchema,
    getPurchaseOrderQuerySchema,
    purchaseOrderIdParamSchema,
    updatePurchaseOrderStatusSchema,
    receivePurchaseOrderItemSchema,
} from "@/api/validators/purchaseOrder.validator.ts";

const router = Router();

// --- Purchase Order Routes ---

// POST /api/purchase-orders - Create a PO (Admin/Manager)
router.post(
    "/",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(createPurchaseOrderSchema),
    purchaseOrderController.handleCreatePurchaseOrder,
);

// GET /api/purchase-orders - Get PO list (All Authenticated, or restrict?)
router.get(
    "/",
    authenticateToken,
    // authorizeRole([UserRole.ADMIN, UserRole.MANAGER]), // Optional: Restrict list view?
    validateRequest(getPurchaseOrderQuerySchema),
    purchaseOrderController.handleGetPurchaseOrders,
);

// GET /api/purchase-orders/:id - Get single PO details
router.get("/:id", authenticateToken, validateRequest(purchaseOrderIdParamSchema), purchaseOrderController.handleGetPurchaseOrderById);

// PATCH /api/purchase-orders/:id/status - Update PO status (Admin/Manager)
router.patch(
    // Use PATCH for partial update like status change
    "/:id/status",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(updatePurchaseOrderStatusSchema),
    purchaseOrderController.handleUpdatePurchaseOrderStatus,
);

// POST /api/purchase-orders/:purchaseOrderId/items/:itemId/receive - Receive items for a line item (Staff/Manager/Admin)
router.post(
    // Nested route structure clearly indicates the action
    "/:purchaseOrderId/items/:itemId/receive",
    authenticateToken,
    authorizeRole([UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN]), // Who can receive stock?
    validateRequest(receivePurchaseOrderItemSchema), // Validates params and body
    purchaseOrderController.handleReceivePurchaseOrderItem,
);

// Note: Updating PO details/items after creation might need separate endpoints/logic
// Note: Deleting POs is omitted, often better to use CANCELLED status.

export default router;
