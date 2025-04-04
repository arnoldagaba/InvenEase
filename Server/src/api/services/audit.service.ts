import { Prisma } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import logger from "@/config/logger.ts";

export const auditLogService = {
    /**
     * Logs an action performed in the system.
     * @param userId ID of the user performing action (null for system)
     * @param action Action code (e.g., 'CREATE_PRODUCT', 'LOGIN_SUCCESS')
     * @param entity Optional entity type (e.g., 'Product')
     * @param entityId Optional ID of the affected entity
     * @param details Optional JSON object with context/changes
     * @param tx Optional Prisma transaction client
     */
    async logAction(
        userId: string | null,
        action: string,
        entity?: string | null,
        entityId?: string | null,
        details?: Prisma.JsonValue | null, // Prisma.JsonValue for type safety
        tx?: Prisma.TransactionClient,
    ): Promise<void> {
        const prismaClient = tx || prisma;
        try {
            await prismaClient.auditLog.create({
                data: {
                    userId: userId,
                    action: action,
                    entity: entity,
                    entityId: entityId,
                    details: details ?? Prisma.DbNull, // Use Prisma.DbNull if details is null/undefined
                    timestamp: new Date(), // Use current time
                },
            });
        } catch (error) {
            // Log error but don't block the main operation
            logger.error(`Failed to create audit log entry for action ${action}`, {
                userId,
                entity,
                entityId,
                details,
                error,
            });
        }
    },

    // Optional: Function to retrieve audit logs (add later if needed)
    // async getAuditLogs(...) {}
};
