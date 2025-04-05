import { Prisma, PurchaseOrder, PurchaseOrderItem, OrderStatus, Product } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { NotFoundError, ConflictError, BadRequestError } from "@/errors/index.ts";
import {
    CreatePurchaseOrderInput,
    GetPurchaseOrderQueryInput,
    ReceivePurchaseOrderItemInput,
    ReceivePurchaseOrderItemParams,
} from "@/api/validators/purchaseOrder.validator.ts";
import { calculateSkip, getPaginationData } from "@/utils/pagination.util.ts";
import { auditLogService } from "./audit.service.ts";
import { transactionService } from "./transaction.service.ts";
import { notificationService } from "./notification.service.ts";
import logger from "@/config/logger.ts";

type PurchaseOrderWithDetails = PurchaseOrder & {
    items: (PurchaseOrderItem & { product: Product })[];
    supplier: { id: string; name: string };
    user: { id: string; email: string };
};

// Helper function to determine overall PO status based on item statuses
const calculateOverallPOStatus = (items: PurchaseOrderItem[]): OrderStatus => {
    if (!items || items.length === 0) {
        return OrderStatus.PENDING; // Or error? Depends on validation
    }

    const totalOrdered = items.reduce((sum, item) => sum + item.quantityOrdered, 0);
    const totalReceived = items.reduce((sum, item) => sum + item.quantityReceived, 0);

    if (totalReceived === 0) {
        // If *any* item was acted upon (even setting received to 0 after having > 0?), need more info.
        // Simplification: If total received is 0, it's likely still pending/approved
        // Check if status was manually set otherwise. Keep existing non-pending if possible? This logic is tricky.
        // Let's assume simple flow: 0 received -> PENDING or APPROVED
        return OrderStatus.PENDING; // Assume needs explicit approval to change from PENDING
    } else if (totalReceived < totalOrdered) {
        return OrderStatus.PARTIAL;
    } else {
        // totalReceived >= totalOrdered (should be equal in normal flow)
        return OrderStatus.RECEIVED; // Intermediate step before optional 'COMPLETED' state
        // Could also go straight to COMPLETED if no further action needed
    }
};

export const purchaseOrderService = {
    /**
     * Creates a new Purchase Order and its items.
     * Validates supplier and product existence.
     * @param userId User creating the PO.
     * @param data PO creation data including items.
     * @returns The newly created PO with items.
     */
    async createPurchaseOrder(userId: string, data: CreatePurchaseOrderInput): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
        const { supplierId, items, orderNumber, ...poData } = data;

        // Use transaction to ensure PO and items are created together, and validation passes
        const newPurchaseOrder = await prisma.$transaction(async (tx) => {
            // 1. Validate Supplier
            const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
            if (!supplier) {
                throw new NotFoundError(`Supplier with ID "${supplierId}" not found.`);
            }

            // 2. Validate all Products
            const productIds = items.map((item) => item.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true }, // Select only needed fields
            });
            if (products.length !== productIds.length) {
                const foundIds = products.map((p) => p.id);
                const notFoundIds = productIds.filter((id) => !foundIds.includes(id));
                throw new NotFoundError(`Product(s) with IDs not found: ${notFoundIds.join(", ")}`);
            }
            // Create a map for easy lookup
            // const productMap = new Map(products.map((p) => [p.id, p]));

            // 3. Generate Order Number if not provided (implement simple sequence or UUID logic)
            let finalOrderNumber = orderNumber;
            if (!finalOrderNumber) {
                // Example: Simple sequence (prone to race conditions without proper locking)
                // const lastOrder = await tx.purchaseOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { orderNumber: true } });
                // const nextNum = (parseInt(lastOrder?.orderNumber?.split('-').pop() ?? '0') || 0) + 1;
                // finalOrderNumber = `PO-${String(nextNum).padStart(5, '0')}`;

                // Safer: Use UUID or timestamp-based approach if uniqueness is critical and sequence not required
                finalOrderNumber = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            } else {
                // Optional: Check if provided orderNumber is unique
                const existingOrderNumber = await tx.purchaseOrder.findUnique({ where: { orderNumber: finalOrderNumber } });
                if (existingOrderNumber) {
                    throw new ConflictError(`Purchase order number "${finalOrderNumber}" already exists.`);
                }
            }

            // 4. Create PurchaseOrder
            const createdPO = await tx.purchaseOrder.create({
                data: {
                    ...poData,
                    orderNumber: finalOrderNumber,
                    userId: userId,
                    supplierId: supplierId,
                    status: OrderStatus.PENDING, // Initial status
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            quantityOrdered: item.quantityOrdered,
                            unitCost: item.unitCost,
                            quantityReceived: 0, // Initialize as 0
                        })),
                    },
                },
                include: { items: true }, // Include items in the return
            });

            // 5. Audit Log
            await auditLogService.logAction(
                userId,
                "CREATE_PURCHASE_ORDER",
                "PurchaseOrder",
                createdPO.id,
                { orderNumber: createdPO.orderNumber, supplierId: createdPO.supplierId, itemCount: createdPO.items.length },
                tx,
            );

            return createdPO;
        }); // End transaction

        return newPurchaseOrder;
    },

    /**
     * Retrieves Purchase Orders based on criteria.
     * @param queryParams Filters, sorting, pagination.
     * @returns Paginated list of POs.
     */
    async getPurchaseOrders(queryParams?: GetPurchaseOrderQueryInput) {
        const {
            page = 1,
            limit = 10,
            supplierId,
            userId,
            status,
            orderNumber,
            productId, // Requires filtering through items relation
            dateFrom,
            dateTo,
            sortBy = "orderDate",
            sortOrder = "desc",
        } = queryParams || {};
        const skip = calculateSkip(page, limit);

        const where: Prisma.PurchaseOrderWhereInput = {};
        if (supplierId) where.supplierId = supplierId;
        if (userId) where.userId = userId;
        if (status) where.status = status;
        if (orderNumber) where.orderNumber = { contains: orderNumber }; // Example: partial match
        if (productId) {
            // Filter POs where *any* item matches the productId
            where.items = { some: { productId: productId } };
        }
        if (dateFrom || dateTo) {
            where.orderDate = {};
            if (dateFrom) where.orderDate.gte = new Date(dateFrom);
            if (dateTo) where.orderDate.lte = new Date(dateTo);
        }

        const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = { [sortBy]: sortOrder };

        const [purchaseOrders, totalCount] = await prisma.$transaction([
            prisma.purchaseOrder.findMany({
                where,
                include: {
                    supplier: { select: { id: true, name: true } },
                    user: { select: { id: true, email: true } },
                    // Optional: Include items count or summary if needed frequently in list view
                    _count: { select: { items: true } },
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.purchaseOrder.count({ where }),
        ]);

        const paginationData = getPaginationData(totalCount, page, limit);
        return { data: purchaseOrders, pagination: paginationData };
    },

    /**
     * Retrieves a single Purchase Order by ID including all details.
     * @param id PO UUID.
     * @returns PO with supplier, user, items (with product details).
     * @throws NotFoundError if not found.
     */
    async getPurchaseOrderById(id: string): Promise<
        PurchaseOrder & {
            items: (PurchaseOrderItem & { product: Product })[];
            supplier: { id: string; name: string };
            user: { id: string; email: string };
        }
    > {
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: { select: { id: true, name: true } },
                user: { select: { id: true, email: true } },
                items: {
                    include: {
                        product: true, // Include full product details for each item
                    },
                    orderBy: { product: { name: "asc" } }, // Sort items alphabetically by product name
                },
            },
        });

        if (!purchaseOrder) {
            throw new NotFoundError(`Purchase Order with ID "${id}" not found.`);
        }
        // Prisma types might need assertion here if includes aren't automatically inferred perfectly
        return purchaseOrder as PurchaseOrderWithDetails;
    },

    /**
     * Updates the status of a Purchase Order.
     * @param id PO UUID.
     * @param status New status.
     * @param notes Optional notes for status change.
     * @param userId User performing the action.
     * @returns Updated PO.
     */
    async updatePurchaseOrderStatus(id: string, status: OrderStatus, notes: string | null | undefined, userId: string): Promise<PurchaseOrder> {
        // Ensure PO exists
        const po = await prisma.purchaseOrder.findUnique({ where: { id } });
        if (!po) {
            throw new NotFoundError(`Purchase Order with ID "${id}" not found.`);
        }

        // Add logic to validate status transitions if needed
        // e.g., cannot go from COMPLETED back to PENDING
        const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
            [OrderStatus.PENDING]: [OrderStatus.APPROVED, OrderStatus.CANCELLED],
            [OrderStatus.APPROVED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.RECEIVED, OrderStatus.PARTIAL], // Can start receiving
            [OrderStatus.PROCESSING]: [OrderStatus.RECEIVED, OrderStatus.PARTIAL, OrderStatus.CANCELLED],
            [OrderStatus.PARTIAL]: [OrderStatus.RECEIVED, OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Can receive more or mark complete
            [OrderStatus.RECEIVED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED], // Can mark complete
            // COMPLETED and CANCELLED are terminal states?
        };

        // Check if the transition is valid
        if (!allowedTransitions[po.status]?.includes(status)) {
            throw new BadRequestError(`Cannot transition PO from status ${po.status} to ${status}.`);
        }

        const updatedPO = await prisma.purchaseOrder.update({
            where: { id },
            data: {
                status: status,
                notes: notes ?? po.notes, // Update notes if provided, else keep existing
            },
        });

        // Notify the user who created the PO about the status change
        notificationService
            .createOrderStatusUpdateNotification(
                updatedPO.id,
                "PurchaseOrder",
                updatedPO.orderNumber,
                updatedPO.status,
                updatedPO.userId, // Notify the PO creator
                // No transaction client needed here as it's after the main update transaction
            )
            .catch((err) => logger.error("Failed to create PO status update notification", err));

        // Audit log
        await auditLogService.logAction(userId, "UPDATE_PURCHASE_ORDER_STATUS", "PurchaseOrder", updatedPO.id, {
            oldStatus: po.status,
            newStatus: updatedPO.status,
            notes: notes,
        });

        return updatedPO;
    },

    /**
     * Records the receipt of items against a specific Purchase Order Item line.
     * Updates POItem quantityReceived, creates Transaction, updates StockLevel, updates PO status. ATOMIC.
     * @param params IDs of PO and PO Item.
     * @param data Receipt details (quantity, location, notes).
     * @param userId User performing the action.
     * @returns Updated PurchaseOrderItem.
     * @throws Various errors if validation fails (NotFound, BadRequest, Conflict).
     */
    async receivePurchaseOrderItem(
        params: ReceivePurchaseOrderItemParams,
        data: ReceivePurchaseOrderItemInput,
        userId: string,
    ): Promise<PurchaseOrderItem> {
        const { purchaseOrderId, itemId } = params;
        const { quantityReceived, destinationLocationId, notes } = data;

        if (quantityReceived <= 0) {
            throw new BadRequestError("Quantity received must be positive.");
        }

        const updatedPOItem = await prisma.$transaction(async (tx) => {
            // 1. Find the PO Item and lock it (if DB supports row locking like SELECT...FOR UPDATE)
            // Prisma handles this implicitly to some degree within transactions, but explicit locking might be needed for high concurrency.
            const poItem = await tx.purchaseOrderItem.findUnique({
                where: { id: itemId, purchaseOrderId: purchaseOrderId }, // Ensure item belongs to the specified PO
                include: { product: true }, // Need product details (ID)
            });

            if (!poItem) {
                throw new NotFoundError(`Purchase Order Item with ID "${itemId}" on PO "${purchaseOrderId}" not found.`);
            }
            if (!poItem.product) {
                throw new NotFoundError(`Product details missing for PO Item "${itemId}".`);
            }

            // 2. Check if PO status allows receiving
            const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
            if (!po) {
                throw new NotFoundError(`Purchase Order "${purchaseOrderId}" not found during item receipt.`);
            } // Should not happen if poItem found

            // Allow receiving on these statuses (adjust based on workflow)
            const allowedReceiveStatuses: OrderStatus[] = [OrderStatus.APPROVED, OrderStatus.PROCESSING, OrderStatus.PARTIAL, OrderStatus.RECEIVED];
            if (!allowedReceiveStatuses.includes(po.status)) {
                throw new ConflictError(`Cannot receive items for Purchase Order with status "${po.status}".`);
            }

            // 3. Check quantity - cannot receive more than ordered
            const newTotalReceived = poItem.quantityReceived + quantityReceived;
            if (newTotalReceived > poItem.quantityOrdered) {
                throw new BadRequestError(
                    `Cannot receive ${quantityReceived} units. Total received (${newTotalReceived}) would exceed ordered quantity (${poItem.quantityOrdered}) for item ${itemId}. Remaining: ${poItem.quantityOrdered - poItem.quantityReceived}`,
                );
            }

            // 4. Validate Destination Location
            const location = await tx.location.findUnique({ where: { id: destinationLocationId } });
            if (!location) {
                throw new NotFoundError(`Destination location with ID "${destinationLocationId}" not found.`);
            }

            // 5. Update PurchaseOrderItem quantityReceived
            const updatedItem = await tx.purchaseOrderItem.update({
                where: { id: itemId },
                data: {
                    quantityReceived: { increment: quantityReceived },
                    // Alternatively: quantityReceived: newTotalReceived
                },
                include: { product: true }, // Keep product included
            });

            // 6. Record the Transaction & Update Stock Level (uses internal transaction logic)
            // Pass the transaction client `tx` to ensure it's part of the atomicity
            await transactionService.recordPurchaseReceipt(
                userId,
                poItem.productId,
                destinationLocationId,
                quantityReceived, // Pass the amount just received
                purchaseOrderId,
                notes,
                tx, // IMPORTANT: Pass the transaction client
            );

            // 7. Recalculate and Update overall PO Status (consider edge cases)
            const allItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: purchaseOrderId } });
            const newOverallStatus = calculateOverallPOStatus(allItems);

            // Update PO status only if it needs changing
            if (po.status !== newOverallStatus && newOverallStatus !== po.status) {
                // Avoid redundant updates
                // Add further logic? e.g. only auto-update if current status isn't manually set terminal state like CANCELLED?
                await tx.purchaseOrder.update({
                    where: { id: purchaseOrderId },
                    data: { status: newOverallStatus },
                });
            }

            // 8. Audit Log
            await auditLogService.logAction(
                userId,
                "RECEIVE_PO_ITEM",
                "PurchaseOrderItem",
                itemId,
                {
                    purchaseOrderId,
                    productId: poItem.productId,
                    quantityReceived,
                    destinationLocationId,
                    newTotalReceivedForItem: updatedItem.quantityReceived,
                    notes,
                },
                tx,
            );

            return updatedItem; // Return the updated item line
        }); // End transaction

        return updatedPOItem;
    },

    // NOTE: Deleting POs might need careful consideration depending on business rules
    // (e.g., prevent deletion if items received? Set to Cancelled instead?).
    // A simple 'deletePO' is omitted for now but would need dependency checks.
};
