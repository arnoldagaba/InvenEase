import { Router } from "express";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { UserRole } from "@prisma/client";

import { stockController } from "@/api/controllers/stock.controller.ts";
import { getStockLevelQuerySchema, getLowStockQuerySchema } from "@/api/validators/stock.validator.ts";

const router = Router();

// --- Stock Level Viewing Routes ---

// GET /api/stock - Get all stock levels with filtering (All authenticated users)
// Added specific validator
router.get("/", authenticateToken, validateRequest(getStockLevelQuerySchema), stockController.handleGetStockLevels);

// GET /api/stock/specific - Get stock for a specific product/location
// (Added a more specific route/handler for this common query)
// It uses the same query schema but the handler expects specific params
// Alternatively, reuse '/' route and enforce query params in controller/service
router.get(
    "/specific", // Consider if this path is better than checking params on '/'
    authenticateToken,
    validateRequest(getStockLevelQuerySchema), // Ensure validator requires productId & locationId? Needs custom validator or logic check.
    stockController.handleGetSpecificStockLevel,
);

// GET /api/stock/low - Get products below reorder level (Admin/Manager)
router.get(
    "/low",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(getLowStockQuerySchema),
    stockController.handleGetLowStock,
);

export default router;
