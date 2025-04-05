import { Prisma } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import logger from "@/config/logger.ts";
import { GetAuditLogQueryInput } from "@/api/validators/audit.validator.ts";
import { calculateSkip, getPaginationData } from "@/utils/pagination.util.ts";

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

    /**
     * Retrieves audit logs based on specified criteria with pagination.
     * @param queryParams - Filters, sorting, pagination options.
     * @returns Paginated list of audit logs.
     */
    async getAuditLogs(queryParams?: GetAuditLogQueryInput) {
        const {
            page = 1,
            limit = 25, // Default to more logs per page
            userId,
            action,
            entity,
            entityId,
            startDate,
            endDate,
            sortBy = "timestamp", // Sorting primarily by timestamp
            sortOrder = "desc",
        } = queryParams || {};
        const skip = calculateSkip(page, limit);

        const where: Prisma.AuditLogWhereInput = {};
        if (userId) where.userId = userId; // Exact match for user
        if (action) where.action = { contains: action }; // Allow partial match? Or use exact match: where.action = action
        if (entity) where.entity = entity;
        if (entityId) where.entityId = entityId;
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) where.timestamp.lte = new Date(endDate);
        }

        // Always order by timestamp
        const orderBy: Prisma.AuditLogOrderByWithRelationInput = { timestamp: sortOrder };

        const [auditLogs, totalCount] = await prisma.$transaction([
            prisma.auditLog.findMany({
                where,
                include: {
                    // Include user details (email is often useful)
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                skip: skip,
                take: limit,
                orderBy: orderBy,
            }),
            prisma.auditLog.count({ where }),
        ]);

        const paginationData = getPaginationData(totalCount, page, limit);

        return {
            data: auditLogs,
            pagination: paginationData,
        };
    },
};
