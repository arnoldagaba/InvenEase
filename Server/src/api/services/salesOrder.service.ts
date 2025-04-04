import { Prisma, SalesOrder, SalesOrderItem, OrderStatus, Product } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { NotFoundError, ConflictError, BadRequestError } from "@/errors/index.ts";
import {
    CreateSalesOrderInput,
    GetSalesOrderQueryInput,
    UpdateSalesOrderStatusInput,
    ShipSalesOrderItemInput,
    ShipSalesOrderItemParams,
} from "@/api/validators/salesOrder.validator.ts";
import { calculateSkip, getPaginationData } from "@/utils/pagination.util.ts";
import { auditLogService } from "./audit.service.ts";
import { transactionService } from "./transaction.service.ts";

interface SalesOrderWithItemsAndUser {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    customerRef: string | null;
    orderNumber: string;
    orderDate: Date;
    shippingDate: Date | null;
    notes: string | null;
    status: OrderStatus;
    userId: string;
    items: (SalesOrderItem & { product: Product })[];
    user: { id: string; email: string };
}

// Helper function to determine overall SO status based on item shipments
const calculateOverallSOStatus = (items: SalesOrderItem[]): OrderStatus => {
    if (!items || items.length === 0) {
        return OrderStatus.PENDING; // Initial state
    }

    const totalOrdered = items.reduce((sum, item) => sum + item.quantityOrdered, 0);
    const totalShipped = items.reduce((sum, item) => sum + item.quantityShipped, 0);

    if (totalShipped === 0) {
        // If nothing shipped, likely PENDING or APPROVED (or maybe PROCESSING if manually set)
        return OrderStatus.PENDING; // Or check current status to avoid reverting from APPROVED/PROCESSING
    } else if (totalShipped < totalOrdered) {
        return OrderStatus.PARTIAL;
    } else {
        // totalShipped >= totalOrdered
        // Consider SHIPPED as intermediate, COMPLETED might require payment confirmation etc.
        return OrderStatus.SHIPPED;
    }
};

export const salesOrderService = {
    /**
     * Creates a new Sales Order and its items.
     * Validates product existence.
     * @param userId User creating the SO.
     * @param data SO creation data including items.
     * @returns The newly created SO with items.
     */
    async createSalesOrder(userId: string, data: CreateSalesOrderInput): Promise<SalesOrder & { items: SalesOrderItem[] }> {
        const { items, orderNumber, ...soData } = data;

        const newSalesOrder = await prisma.$transaction(async (tx) => {
            // 1. Validate all Products exist
            const productIds = items.map((item) => item.productId);
            const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
            if (products.length !== productIds.length) {
                const foundIds = products.map((p) => p.id);
                const notFoundIds = productIds.filter((id) => !foundIds.includes(id));
                throw new NotFoundError(`Product(s) with IDs not found: ${notFoundIds.join(", ")}`);
            }

            // 2. Generate Order Number if needed
            let finalOrderNumber = orderNumber;
            if (!finalOrderNumber) {
                finalOrderNumber = `SO-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            } else {
                const existingOrderNumber = await tx.salesOrder.findUnique({ where: { orderNumber: finalOrderNumber } });
                if (existingOrderNumber) {
                    throw new ConflictError(`Sales order number "${finalOrderNumber}" already exists.`);
                }
            }

            // 3. Create SalesOrder and Items
            const createdSO = await tx.salesOrder.create({
                data: {
                    ...soData,
                    orderNumber: finalOrderNumber,
                    userId: userId,
                    status: OrderStatus.PENDING, // Initial status
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            quantityOrdered: item.quantityOrdered,
                            unitPrice: item.unitPrice,
                            quantityShipped: 0, // Initialize as 0
                        })),
                    },
                },
                include: { items: true },
            });

            // 4. Audit Log
            await auditLogService.logAction(
                userId,
                "CREATE_SALES_ORDER",
                "SalesOrder",
                createdSO.id,
                { orderNumber: createdSO.orderNumber, customerRef: createdSO.customerRef, itemCount: createdSO.items.length },
                tx,
            );

            return createdSO;
        }); // End transaction

        return newSalesOrder;
    },

    /**
     * Retrieves Sales Orders based on criteria.
     * @param queryParams Filters, sorting, pagination.
     * @returns Paginated list of SOs.
     */
    async getSalesOrders(queryParams?: GetSalesOrderQueryInput) {
        const {
            page = 1,
            limit = 10,
            customerRef,
            userId,
            status,
            orderNumber,
            productId,
            dateFrom,
            dateTo,
            sortBy = "orderDate",
            sortOrder = "desc",
        } = queryParams || {};
        const skip = calculateSkip(page, limit);

        const where: Prisma.SalesOrderWhereInput = {};
        if (customerRef) where.customerRef = { contains: customerRef };
        if (userId) where.userId = userId;
        if (status) where.status = status;
        if (orderNumber) where.orderNumber = { contains: orderNumber };
        if (productId) where.items = { some: { productId: productId } };
        if (dateFrom || dateTo) {
            where.orderDate = {};
            if (dateFrom) where.orderDate.gte = new Date(dateFrom);
            if (dateTo) where.orderDate.lte = new Date(dateTo);
        }

        const orderBy: Prisma.SalesOrderOrderByWithRelationInput = { [sortBy]: sortOrder };

        const [salesOrders, totalCount] = await prisma.$transaction([
            prisma.salesOrder.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true } },
                    _count: { select: { items: true } },
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.salesOrder.count({ where }),
        ]);

        const paginationData = getPaginationData(totalCount, page, limit);
        return { data: salesOrders, pagination: paginationData };
    },

    /**
     * Retrieves a single Sales Order by ID including details.
     * @param id SO UUID.
     * @returns SO with user, items (with product details).
     * @throws NotFoundError if not found.
     */
    async getSalesOrderById(
        id: string,
    ): Promise<SalesOrder & { items: (SalesOrderItem & { product: Product })[]; user: { id: string; email: string } }> {
        const salesOrder = await prisma.salesOrder.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, email: true } },
                items: {
                    include: {
                        product: true,
                    },
                    orderBy: { product: { name: "asc" } },
                },
            },
        });

        if (!salesOrder) {
            throw new NotFoundError(`Sales Order with ID "${id}" not found.`);
        }
        return salesOrder as SalesOrderWithItemsAndUser;
    },

    /**
     * Updates the status and potentially shipping date/notes of a Sales Order.
     * @param id SO UUID.
     * @param updateData Status, optional shipping date and notes.
     * @param userId User performing the action.
     * @returns Updated SO.
     */
    async updateSalesOrderStatus(id: string, updateData: UpdateSalesOrderStatusInput, userId: string): Promise<SalesOrder> {
        const { status, shippingDate, notes } = updateData;

        const so = await prisma.salesOrder.findUnique({ where: { id } });
        if (!so) {
            throw new NotFoundError(`Sales Order with ID "${id}" not found.`);
        }

        // Basic transition validation example (adjust as needed)
        if (so.status === OrderStatus.CANCELLED || so.status === OrderStatus.COMPLETED) {
            if (status && status !== so.status) {
                // Don't allow changing status FROM terminal states
                throw new BadRequestError(`Cannot change status of a ${so.status} order.`);
            }
        }

        const dataToUpdate: Prisma.SalesOrderUpdateInput = {};
        if (status) dataToUpdate.status = status;
        if (shippingDate) dataToUpdate.shippingDate = new Date(shippingDate); // Convert string to Date
        if (notes !== undefined) dataToUpdate.notes = notes; // Allow setting notes to null or new value

        if (Object.keys(dataToUpdate).length === 0) {
            return so; // Nothing to update
        }

        const updatedSO = await prisma.salesOrder.update({
            where: { id },
            data: dataToUpdate,
        });

        // Audit log
        await auditLogService.logAction(userId, "UPDATE_SALES_ORDER_STATUS", "SalesOrder", updatedSO.id, {
            changes: { status, shippingDate, notes },
            oldStatus: so.status,
        });

        return updatedSO;
    },

    /**
     * Records the shipment of items against a specific Sales Order Item line.
     * Updates SOItem quantityShipped, creates Transaction (SALE type), updates StockLevel (decrements), updates SO status. ATOMIC.
     * @param params IDs of SO and SO Item.
     * @param data Shipment details (quantity, source location, notes).
     * @param userId User performing the action.
     * @returns Updated SalesOrderItem.
     * @throws Various errors if validation fails.
     */
    async shipSalesOrderItem(params: ShipSalesOrderItemParams, data: ShipSalesOrderItemInput, userId: string): Promise<SalesOrderItem> {
        const { salesOrderId, itemId } = params;
        const { quantityShipped, sourceLocationId, notes } = data;

        if (quantityShipped <= 0) {
            throw new BadRequestError("Quantity shipped must be positive.");
        }

        const updatedSOItem = await prisma.$transaction(async (tx) => {
            // 1. Find the SO Item, Product, and SO itself
            const soItem = await tx.salesOrderItem.findUnique({
                where: { id: itemId, salesOrderId: salesOrderId },
                include: { product: true }, // Need product ID
            });
            if (!soItem) {
                throw new NotFoundError(`Sales Order Item ID "${itemId}" on SO "${salesOrderId}" not found.`);
            }
            if (!soItem.product) {
                throw new NotFoundError(`Product details missing for SO Item "${itemId}".`);
            }

            const so = await tx.salesOrder.findUnique({ where: { id: salesOrderId } });
            if (!so) {
                throw new NotFoundError(`Sales Order "${salesOrderId}" not found during item shipment.`);
            }

            // 2. Check if SO status allows shipping (e.g., Approved, Processing, Partial)
            const allowedShipStatuses: OrderStatus[] = [OrderStatus.APPROVED, OrderStatus.PROCESSING, OrderStatus.PARTIAL, OrderStatus.SHIPPED]; // Allow shipping if PARTIAL/SHIPPED to ship more
            if (!allowedShipStatuses.includes(so.status)) {
                throw new ConflictError(`Cannot ship items for Sales Order with status "${so.status}".`);
            }

            // 3. Check quantity - cannot ship more than remaining ordered quantity
            const remainingToShip = soItem.quantityOrdered - soItem.quantityShipped;
            if (quantityShipped > remainingToShip) {
                throw new BadRequestError(
                    `Cannot ship ${quantityShipped} units. Only ${remainingToShip} units remaining for item ${itemId} (Ordered: ${soItem.quantityOrdered}, Already Shipped: ${soItem.quantityShipped}).`,
                );
            }

            // 4. Validate Source Location
            const location = await tx.location.findUnique({ where: { id: sourceLocationId } });
            if (!location) {
                throw new NotFoundError(`Source location ID "${sourceLocationId}" not found.`);
            }

            // 5. Record the SALE Transaction & Decrement Stock Level
            // transactionService.recordSaleShipment handles the stock decrement and negative checks
            await transactionService.recordSaleShipment(
                userId,
                soItem.productId,
                sourceLocationId,
                quantityShipped, // Positive number indicating quantity actioned
                salesOrderId,
                notes,
                tx, // IMPORTANT: Pass transaction client
            );
            // If recordSaleShipment throws ConflictError (insufficient stock), the transaction will roll back.

            // 6. Update SalesOrderItem quantityShipped
            const updatedItem = await tx.salesOrderItem.update({
                where: { id: itemId },
                data: {
                    quantityShipped: { increment: quantityShipped },
                },
                include: { product: true },
            });

            // 7. Recalculate and Update overall SO Status
            const allItems = await tx.salesOrderItem.findMany({ where: { salesOrderId: salesOrderId } });
            const newOverallStatus = calculateOverallSOStatus(allItems);

            // Define the array with an explicit type annotation
            const terminalStatuses: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];

            // Now 'includes' should correctly accept any OrderStatus
            if (so.status !== newOverallStatus && !terminalStatuses.includes(so.status)) {
                // Avoid overriding terminal states
                await tx.salesOrder.update({
                    where: { id: salesOrderId },
                    data: { status: newOverallStatus },
                });
            }

            // 8. Audit Log
            await auditLogService.logAction(
                userId,
                "SHIP_SO_ITEM",
                "SalesOrderItem",
                itemId,
                {
                    salesOrderId,
                    productId: soItem.productId,
                    quantityShipped,
                    sourceLocationId,
                    newTotalShippedForItem: updatedItem.quantityShipped,
                    notes,
                },
                tx,
            );

            return updatedItem; // Return updated SO Item line
        }); // End transaction

        return updatedSOItem;
    },

    // Deletion logic similar to POs - omitted for now, favor CANCELLED status.
};
