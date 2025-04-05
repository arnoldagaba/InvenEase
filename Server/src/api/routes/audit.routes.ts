import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";

import { auditController } from "@/api/controllers/audit.controller.ts";
import { getAuditLogQuerySchema } from "@/api/validators/audit.validator.ts";

const router = Router();

// --- Audit Log Routes ---

// GET /api/audit-logs - Get audit log history (Admin only)
router.get(
    "/",
    authenticateToken,
    authorizeRole([UserRole.ADMIN]), // Strictly Admin access
    validateRequest(getAuditLogQuerySchema),
    auditController.handleGetAuditLogs,
);

export default router;
