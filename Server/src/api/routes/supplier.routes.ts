import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";

import { supplierController } from "@/api/controllers/supplier.controller.ts";
import { createSupplierSchema, updateSupplierSchema, supplierIdParamSchema, getSupplierQuerySchema } from "@/api/validators/supplier.validator.ts";

const router = Router();

// --- Supplier Routes ---

// POST /api/suppliers (Admin/Manager)
router.post(
    "/",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(createSupplierSchema),
    supplierController.handleCreateSupplier,
);

// GET /api/suppliers (All authenticated)
router.get("/", authenticateToken, validateRequest(getSupplierQuerySchema), supplierController.handleGetAllSuppliers);

// GET /api/suppliers/:id (All authenticated)
router.get("/:id", authenticateToken, validateRequest(supplierIdParamSchema), supplierController.handleGetSupplierById);

// PUT /api/suppliers/:id (Admin/Manager)
router.put(
    "/:id",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(updateSupplierSchema),
    supplierController.handleUpdateSupplier,
);

// DELETE /api/suppliers/:id (Admin)
router.delete(
    "/:id",
    authenticateToken,
    authorizeRole([UserRole.ADMIN]),
    validateRequest(supplierIdParamSchema),
    supplierController.handleDeleteSupplier,
);

export default router;
