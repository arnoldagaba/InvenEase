import { Router } from "express";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { UserRole } from "@prisma/client";

import { transactionController } from "@/api/controllers/transaction.controller.ts";
import { createAdjustmentSchema, createTransferSchema, getTransactionQuerySchema } from "@/api/validators/transaction.validator.ts";

const router = Router();

// --- Transaction Routes ---

// POST /api/transactions/adjustments - Record a stock adjustment (Admin/Manager)
router.post(
    "/adjustments",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(createAdjustmentSchema),
    transactionController.handleRecordAdjustment,
);

// POST /api/transactions/transfers - Record an inventory transfer (Admin/Manager)
router.post(
    "/transfers",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(createTransferSchema),
    transactionController.handleRecordTransfer,
);

// GET /api/transactions - Get transaction history (All authenticated users, maybe restrict further?)
router.get(
    "/",
    authenticateToken,
    // Potentially add authorizeRole if not all users should see all history
    // authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(getTransactionQuerySchema),
    transactionController.handleGetTransactionHistory,
);

export default router;
