import { Router } from "express";
import { authenticateToken } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";

import { notificationController } from "@/api/controllers/notification.controller.ts";
import { getNotificationQuerySchema, notificationIdParamSchema } from "@/api/validators/notification.validator.ts";

const router = Router();

// --- Notification Routes (All require authentication) ---

// GET /api/notifications - Get notifications for the logged-in user
router.get("/", authenticateToken, validateRequest(getNotificationQuerySchema), notificationController.handleGetUserNotifications);

// PATCH /api/notifications/:id/read - Mark a specific notification as read
router.patch(
    // PATCH is suitable for partial updates (changing read status)
    "/:id/read",
    authenticateToken,
    validateRequest(notificationIdParamSchema), // Validates :id format
    notificationController.handleMarkNotificationAsRead,
);

// POST /api/notifications/read-all - Mark all user's notifications as read
router.post(
    // POST might be slightly better than PATCH for a bulk action
    "/read-all",
    authenticateToken,
    // No specific validation needed for the request itself, just authentication
    notificationController.handleMarkAllNotificationsAsRead,
);

export default router;
