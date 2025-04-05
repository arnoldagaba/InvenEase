import { Prisma, Notification, NotificationType, Product, OrderStatus } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { GetNotificationQueryInput } from "@/api/validators/notification.validator.ts";
import { calculateSkip, getPaginationData } from "@/utils/pagination.util.ts";
import logger from "@/config/logger.ts";
import { NotFoundError } from "@/errors/index.ts";
import { io } from "@/index.ts";

export const notificationService = {
    /**
     * INTERNAL USE: Creates a notification for a specific user.
     * Optionally triggers a real-time event via Socket.IO.
     *
     * @param userId ID of the user to notify.
     * @param message Notification message content.
     * @param type Optional notification category.
     * @param relatedEntityId Optional ID of the entity related to the notification.
     * @param relatedEntityType Optional type string of the related entity.
     * @param tx Optional Prisma Transaction Client.
     * @returns The created notification.
     */
    async createNotification(
        userId: string,
        message: string,
        type?: NotificationType,
        relatedEntityId?: string,
        relatedEntityType?: string,
        tx?: Prisma.TransactionClient,
    ): Promise<Notification> {
        const prismaClient = tx || prisma;
        try {
            const newNotification = await prismaClient.notification.create({
                data: {
                    userId,
                    message,
                    type,
                    relatedEntityId,
                    relatedEntityType,
                    isRead: false, // Notifications always start unread
                },
            });

            logger.info(`Notification created for user ${userId}: "${message}" (Type: ${type || "N/A"})`);

            // (Optional but implemented now) Emit Socket.IO event to the specific user's room/socket
            if (io) {
                // Emit event to the room named after the userId
                io.to(userId).emit("new_notification", {
                    // Send the event to the user's room
                    id: newNotification.id,
                    message: newNotification.message,
                    type: newNotification.type,
                    isRead: newNotification.isRead,
                    createdAt: newNotification.createdAt,
                    // Only send necessary data to client
                });
                logger.debug(`Socket.IO event 'new_notification' emitted to room ${userId}`);
            }

            return newNotification;
        } catch (error) {
            // Log error but typically don't block the originating action
            logger.error(`Failed to create notification for user ${userId}: ${error instanceof Error ? error.message : String(error)}`, {
                userId,
                message,
                type,
                relatedEntityId,
                relatedEntityType,
            });
            // Rethrow only if creation failure is critical (unlikely for notifications)
            // throw error;
            // Return a partial or dummy object, or null, depending on desired error handling
            // For now, let it fail silently in terms of the calling function by not rethrowing
            return {} as Notification;
        }
    },

    /**
     * Retrieves notifications for a specific user with pagination and filtering.
     * @param userId ID of the user whose notifications to retrieve.
     * @param queryParams Filtering (isRead) and pagination options.
     * @returns Paginated list of notifications.
     */
    async getUserNotifications(userId: string, queryParams?: GetNotificationQueryInput) {
        const { page = 1, limit = 15, isRead } = queryParams || {};
        const skip = calculateSkip(page, limit);

        const where: Prisma.NotificationWhereInput = {
            userId: userId,
        };
        if (isRead !== undefined) {
            // Check for true or false
            where.isRead = isRead;
        }

        const orderBy: Prisma.NotificationOrderByWithRelationInput = {
            createdAt: "desc", // Show newest first
        };

        const [notifications, totalCount, unreadCount] = await prisma.$transaction([
            prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy,
            }),
            prisma.notification.count({ where }),
            // Count only unread ones specifically for the user for badge display
            prisma.notification.count({ where: { userId: userId, isRead: false } }),
        ]);

        const paginationData = getPaginationData(totalCount, page, limit);

        return {
            data: notifications,
            pagination: paginationData,
            unreadCount: unreadCount, // Include total unread count
        };
    },

    /**
     * Marks a specific notification as read for the owning user.
     * @param notificationId ID of the notification to mark read.
     * @param userId ID of the user making the request (to ensure ownership).
     * @returns The updated notification.
     * @throws NotFoundError if notification not found or user doesn't own it.
     */
    async markNotificationAsRead(notificationId: string, userId: string): Promise<Notification> {
        // Find the notification ensuring it belongs to the user
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new NotFoundError(`Notification with ID "${notificationId}" not found.`);
        }
        if (notification.userId !== userId) {
            logger.warn(`User ${userId} attempted to mark notification ${notificationId} belonging to user ${notification.userId} as read.`);
            throw new NotFoundError(`Notification with ID "${notificationId}" not found.`); // Treat as not found for security
        }

        // Only update if it's currently unread to avoid unnecessary writes
        if (!notification.isRead) {
            return prisma.notification.update({
                where: { id: notificationId },
                data: { isRead: true },
            });
        } else {
            return notification; // Return the existing notification if already read
        }
    },

    /**
     * Marks all unread notifications as read for a specific user.
     * @param userId ID of the user whose notifications to mark read.
     * @returns A batch payload indicating how many notifications were updated.
     */
    async markAllNotificationsAsRead(userId: string): Promise<Prisma.BatchPayload> {
        // Update many notifications where userId matches and isRead is false
        const result = await prisma.notification.updateMany({
            where: {
                userId: userId,
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });

        logger.info(`Marked ${result.count} notifications as read for user ${userId}`);
        return result;
    },

    // --- Specific Helper Functions for Creating Notifications (Examples) ---
    // These would be called by other services

    async createLowStockNotification(
        product: Product, // Pass the relevant product object
        locationId: string,
        currentQuantity: number,
        tx?: Prisma.TransactionClient,
    ) {
        // Maybe notify admins/managers?
        // Fetch Admin/Manager User IDs (implement user finding logic)
        // const userIdsToNotify = await findAdminManagerUserIds(tx);
        // Define a placeholder (replace with actual user finding logic)
        const userIdsToNotify: string[] = await this.findAdminManagerUserIds(tx); // ["admin-uuid-1", "manager-uuid-1"];

        const message = `Low stock alert: ${product.name} (SKU: ${product.sku}) is at ${currentQuantity} units (Reorder Level: ${product.reorderLevel}) at location ID ${locationId}.`;

        for (const userId of userIdsToNotify) {
            await this.createNotification(
                userId,
                message,
                NotificationType.LOW_STOCK,
                product.id, // Related entity is the product
                "Product", // Type of related entity
                tx,
            );
        }
    },

    async createOrderStatusUpdateNotification(
        orderId: string,
        orderType: "PurchaseOrder" | "SalesOrder", // Discriminate entity type
        orderNumber: string,
        newStatus: OrderStatus,
        userIdToNotify: string, // Notify the user who created the order, or a customer maybe?
        tx?: Prisma.TransactionClient,
    ) {
        const orderTypeName = orderType === "PurchaseOrder" ? "Purchase Order" : "Sales Order";
        const message = `${orderTypeName} #${orderNumber} status updated to ${newStatus}.`;
        await this.createNotification(userIdToNotify, message, NotificationType.ORDER_STATUS_UPDATE, orderId, orderType, tx);
    },

    // Helper to find users with specific roles (example implementation)
    // Move to UserService if more appropriate
    async findAdminManagerUserIds(tx?: Prisma.TransactionClient): Promise<string[]> {
        const prismaClient = tx || prisma;
        const users = await prismaClient.user.findMany({
            where: {
                role: { in: ["ADMIN", "MANAGER"] },
                isActive: true,
            },
            select: { id: true },
        });
        return users.map((u) => u.id);
    },
};
