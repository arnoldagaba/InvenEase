import { Prisma, Transaction, TransactionType, PrismaClient } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { stockService } from "./stock.service.ts";
import { auditLogService } from "./audit.service.ts";
import { BadRequestError } from "@/errors/index.ts";
import { CreateAdjustmentInput, CreateTransferInput, GetTransactionQueryInput } from "@/api/validators/transaction.validator.ts";
import { calculateSkip, getPaginationData } from "@/utils/pagination.util.ts";
import logger from "@/config/logger.ts";

export const transactionService = {
    /**
     * Records a stock adjustment (IN or OUT).
     * Creates a Transaction record and calls stockService.adjustStockLevel.
     * Ensures operation happens within a database transaction.
     * @param userId - ID of the user performing the adjustment.
     * @param data - Validated adjustment data.
     * @returns The created Transaction record.
     */
    async recordAdjustment(userId: string, data: CreateAdjustmentInput): Promise<Transaction> {
        const { productId, locationId, quantityChange, type, notes } = data;

        // Determine actual change amount and direction
        const actualQuantityChange = type === TransactionType.ADJUSTMENT_IN ? quantityChange : -quantityChange;

        // Validate product and location existence (can be done within transaction for atomicity)
        // Let adjustStockLevel handle detailed checks

        try {
            const newTransaction = await prisma.$transaction(async (tx) => {
                // 1. Adjust Stock Level (within the transaction)
                // For ADJUSTMENT_OUT, we need to check if stock will go negative.
                const checkNegative = type === TransactionType.ADJUSTMENT_OUT;
                await stockService.adjustStockLevel(
                    productId,
                    locationId,
                    actualQuantityChange,
                    checkNegative, // Enable negative check for deductions
                    tx, // Pass the transaction client
                );

                // 2. Create the Transaction record
                const transaction = await tx.transaction.create({
                    data: {
                        type: type,
                        productId: productId,
                        quantityChange: actualQuantityChange,
                        userId: userId,
                        // For Adjustments, IN means it arrives at location, OUT means it leaves from location
                        sourceLocationId: type === TransactionType.ADJUSTMENT_OUT ? locationId : null,
                        destinationLocationId: type === TransactionType.ADJUSTMENT_IN ? locationId : null,
                        notes: notes,
                        timestamp: new Date(), // Explicit timestamp (though default exists)
                    },
                    include: { product: true, sourceLocation: true, destinationLocation: true, user: { select: { id: true, email: true } } }, // Include details
                });

                // 3. Log the audit event (within the transaction)
                await auditLogService.logAction(
                    userId,
                    `STOCK_${type}`, // e.g., STOCK_ADJUSTMENT_IN
                    "StockLevel", // Entity affected conceptually
                    `${productId}_${locationId}`, // Composite ID idea for stock level
                    { transactionId: transaction.id, change: actualQuantityChange, locationId: locationId, notes }, // Contextual details
                    tx, // Pass transaction client
                );

                return transaction; // Return the created transaction record
            });

            return newTransaction;
        } catch (error) {
            logger.error(`Error recording adjustment: ${error instanceof Error ? error.message : String(error)}`, { userId, data });
            // Re-throw specific errors (like ConflictError from adjustStockLevel)
            // or generic ones caught by global handler
            throw error;
        }
    },

    /**
     * Records an inventory transfer between two locations.
     * Creates two Transaction records (TRANSFER_OUT, TRANSFER_IN) and calls adjustStockLevel twice.
     * Uses a database transaction for atomicity.
     * @param userId - ID of the user performing the transfer.
     * @param data - Validated transfer data.
     * @returns An object containing both created Transaction records.
     */
    async recordTransfer(userId: string, data: CreateTransferInput): Promise<{ outTx: Transaction; inTx: Transaction }> {
        const { productId, sourceLocationId, destinationLocationId, quantity, notes } = data;

        if (sourceLocationId === destinationLocationId) {
            throw new BadRequestError("Source and destination locations cannot be the same.");
        }
        if (quantity <= 0) {
            throw new BadRequestError("Transfer quantity must be positive.");
        }

        // Negative quantity for the source adjustment
        const quantityOut = -quantity;
        // Positive quantity for the destination adjustment
        const quantityIn = quantity;

        try {
            const { transferOutTx, transferInTx } = await prisma.$transaction(async (tx) => {
                // 1. Check & Decrement source location stock (negative check enabled)
                await stockService.adjustStockLevel(
                    productId,
                    sourceLocationId,
                    quantityOut,
                    true, // Check if source goes negative
                    tx,
                );

                // 2. Increment destination location stock (negative check usually not needed for increment)
                // Note: If adjustStockLevel doesn't implicitly find/validate Product/Location, add checks here.
                await stockService.adjustStockLevel(
                    productId,
                    destinationLocationId,
                    quantityIn,
                    false, // Don't need negative check on increment usually
                    tx,
                );

                // 3. Create TRANSFER_OUT transaction record
                const outTx = await tx.transaction.create({
                    data: {
                        type: TransactionType.TRANSFER_OUT,
                        productId: productId,
                        quantityChange: quantityOut, // Negative
                        userId: userId,
                        sourceLocationId: sourceLocationId,
                        destinationLocationId: destinationLocationId, // Track where it went
                        notes: notes,
                    },
                    // No include needed if returning from the transaction function directly? Or include for return value structure.
                });

                // 4. Create TRANSFER_IN transaction record
                const inTx = await tx.transaction.create({
                    data: {
                        type: TransactionType.TRANSFER_IN,
                        productId: productId,
                        quantityChange: quantityIn, // Positive
                        userId: userId,
                        sourceLocationId: sourceLocationId, // Track where it came from
                        destinationLocationId: destinationLocationId,
                        notes: notes,
                    },
                });

                // 5. Audit Log (can log one event summarizing the transfer)
                await auditLogService.logAction(
                    userId,
                    "STOCK_TRANSFER",
                    "StockLevel", // Conceptual entity
                    `${productId}_${sourceLocationId}_${destinationLocationId}`, // Composite idea
                    {
                        quantity: quantity,
                        fromLocationId: sourceLocationId,
                        toLocationId: destinationLocationId,
                        outTxId: outTx.id,
                        inTxId: inTx.id,
                        notes,
                    },
                    tx,
                );

                return { transferOutTx: outTx, transferInTx: inTx }; // Needs to match awaited return type structure
            }); // End of $transaction

            return { outTx: transferOutTx, inTx: transferInTx };
        } catch (error) {
            logger.error(`Error recording transfer: ${error instanceof Error ? error.message : String(error)}`, { userId, data });
            throw error; // Re-throw for global handler
        }
    },

    /**
     * INTERNAL HELPER: Records a transaction resulting from a Purchase Order receipt.
     * Called by PurchaseOrderService.
     * @param userId User confirming receipt
     * @param productId Product being received
     * @param destinationLocationId Where the product is received
     * @param quantityChange Positive quantity received
     * @param relatedPoId ID of the related Purchase Order
     * @param notes Optional notes
     * @param tx Optional Prisma Transaction Client
     * @returns The created Transaction record.
     */
    async recordPurchaseReceipt(
        userId: string,
        productId: string,
        destinationLocationId: string,
        quantityChange: number,
        relatedPoId: string,
        notes?: string | null,
        tx?: Prisma.TransactionClient,
    ): Promise<Transaction> {
        if (quantityChange <= 0) {
            throw new BadRequestError("Purchase receipt quantity must be positive.");
        }
        const prismaClient = tx || prisma; // Use transaction client if available

        // 1. Adjust stock level (no negative check needed for increase)
        // Note: adjustStockLevel handles creation if it's the first time product exists at location
        await stockService.adjustStockLevel(
            productId,
            destinationLocationId,
            quantityChange,
            false,
            prismaClient instanceof PrismaClient ? prismaClient : undefined, // Pass tx correctly
        );

        // 2. Create Transaction record
        const transaction = await prismaClient.transaction.create({
            data: {
                type: TransactionType.PURCHASE,
                productId: productId,
                quantityChange: quantityChange,
                userId: userId,
                destinationLocationId: destinationLocationId,
                relatedPoId: relatedPoId,
                notes: notes,
            },
        });

        // 3. Audit Log (potentially logged by the calling PurchaseOrderService for better context)
        // If logging here, ensure context like PO number is included if possible.
        // await auditLogService.logAction(...);

        return transaction;
    },

    /**
     * INTERNAL HELPER: Records a transaction resulting from a Sales Order shipment.
     * Called by SalesOrderService.
     * @param userId User confirming shipment
     * @param productId Product being shipped
     * @param sourceLocationId Where the product is shipped from
     * @param quantityChange Positive quantity shipped (will be stored as negative change)
     * @param relatedSoId ID of the related Sales Order
     * @param notes Optional notes
     * @param tx Optional Prisma Transaction Client
     * @returns The created Transaction record.
     */
    async recordSaleShipment(
        userId: string,
        productId: string,
        sourceLocationId: string,
        quantityChange: number,
        relatedSoId: string,
        notes?: string | null,
        tx?: Prisma.TransactionClient,
    ): Promise<Transaction> {
        if (quantityChange <= 0) {
            throw new BadRequestError("Sale shipment quantity must be positive.");
        }
        const actualQuantityChange = -quantityChange; // Store as negative
        const prismaClient = tx || prisma;

        // 1. Adjust stock level (negative check IS needed)
        await stockService.adjustStockLevel(
            productId,
            sourceLocationId,
            actualQuantityChange,
            true, // Check for negative stock
            prismaClient instanceof PrismaClient ? prismaClient : undefined,
        );

        // 2. Create Transaction record
        const transaction = await prismaClient.transaction.create({
            data: {
                type: TransactionType.SALE,
                productId: productId,
                quantityChange: actualQuantityChange, // Negative
                userId: userId,
                sourceLocationId: sourceLocationId,
                relatedSoId: relatedSoId,
                notes: notes,
            },
        });

        // 3. Audit Log (potentially logged by the calling SalesOrderService)

        return transaction;
    },

    /**
     * Retrieves transaction history with filtering and pagination.
     * @param queryParams - Filters, sorting, pagination.
     * @returns Paginated list of transactions.
     */
    async getTransactionHistory(queryParams?: GetTransactionQueryInput) {
        const {
            page = 1,
            limit = 20, // Default to more transactions per page?
            productId,
            locationId, // Ambiguous: source or destination? Need careful filter design.
            userId,
            type,
            relatedPoId,
            relatedSoId,
            startDate,
            endDate,
            sortBy = "timestamp",
            sortOrder = "desc",
        } = queryParams || {};
        const skip = calculateSkip(page, limit);

        const where: Prisma.TransactionWhereInput = {};
        if (productId) where.productId = productId;
        if (locationId) {
            // Filter if location matches either source OR destination
            where.OR = [{ sourceLocationId: locationId }, { destinationLocationId: locationId }];
        }
        if (userId) where.userId = userId;
        if (type) where.type = type;
        if (relatedPoId) where.relatedPoId = relatedPoId;
        if (relatedSoId) where.relatedSoId = relatedSoId;
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) where.timestamp.lte = new Date(endDate);
        }

        const orderBy: Prisma.TransactionOrderByWithRelationInput = { [sortBy]: sortOrder };

        const [transactions, totalCount] = await prisma.$transaction([
            prisma.transaction.findMany({
                where,
                include: {
                    product: { select: { id: true, name: true, sku: true } },
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    sourceLocation: { select: { id: true, name: true } },
                    destinationLocation: { select: { id: true, name: true } },
                    // Include PO/SO links if needed often
                    purchaseOrder: { select: { id: true, orderNumber: true } },
                    salesOrder: { select: { id: true, orderNumber: true } },
                },
                skip: skip,
                take: limit,
                orderBy: orderBy,
            }),
            prisma.transaction.count({ where }),
        ]);

        const paginationData = getPaginationData(totalCount, page, limit);

        return {
            data: transactions,
            pagination: paginationData,
        };
    },
};
