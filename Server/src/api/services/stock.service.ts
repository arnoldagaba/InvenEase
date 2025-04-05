import { Prisma, StockLevel, Product } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { BadRequestError, ConflictError, NotFoundError } from "@/errors/index.ts";
import { GetStockLevelQueryInput, GetLowStockQueryInput } from "@/api/validators/stock.validator.ts";
import { calculateSkip, getPaginationData } from "@/utils/pagination.util.ts";
import logger from "@/config/logger.ts";
import { notificationService } from "./notification.service.ts";

interface RawStockLevelResult {
    id: number;
    productId: string;
    locationId: string;
    quantity: number;
    lastUpdated: Date;
    product: {
        id: string;
        name: string;
        sku: string;
        unit: string;
        reorderLevel: number;
        description: string;
        costPrice: number;
        sellingPrice: number;
        imageUrl: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
    };
    location: {
        id: string;
        name: string;
    };
}

export const stockService = {
    /**
     * INTERNAL USE ONLY: Adjusts the stock level for a product at a location.
     * Creates a StockLevel record if it doesn't exist (with initial adjustment).
     * Ensures atomicity for read-modify-write using Prisma transactions implicitly if needed.
     * Note: This function does NOT create the Transaction record itself. That's the responsibility
     * of the calling service (e.g., TransactionService, OrderService).
     *
     * @param productId - ID of the product.
     * @param locationId - ID of the location.
     * @param quantityChange - Positive integer for increase, negative integer for decrease.
     * @param checkNegative - If true, prevents stock from going below zero. Defaults to true.
     * @param tx - Optional: Prisma Transaction Client for atomic operations.
     * @returns The updated or newly created StockLevel record.
     * @throws NotFoundError if Product or Location doesn't exist.
     * @throws BadRequestError if quantityChange is zero or invalid.
     * @throws ConflictError if checkNegative is true and operation would result in negative stock.
     */
    async adjustStockLevel(
        productId: string,
        locationId: string,
        quantityChange: number,
        checkNegative: boolean = true,
        tx?: Prisma.TransactionClient,
    ): Promise<StockLevel & { product: Product }> {
        // Adjusted return type to match original intent if product is needed by caller
        if (quantityChange === 0) {
            throw new BadRequestError("Quantity change cannot be zero.");
        }

        const prismaClient = tx || prisma;

        // Retrieve the product's reorder level *before* upserting stock
        // This is needed for the post-update low-stock check if not including product in upsert
        // We will include product in the upsert now to simplify

        try {
            const result = await prismaClient.stockLevel.upsert({
                where: {
                    productId_locationId: { productId, locationId },
                },
                create: {
                    productId: productId,
                    locationId: locationId,
                    quantity: Math.max(0, quantityChange),
                },
                update: {
                    quantity: {
                        increment: quantityChange,
                    },
                },
                include: { product: true }, // Include product here for checks
            });

            // Post-update check for negative quantity if required
            if (checkNegative && result.quantity < 0) {
                // The conflict needs to be raised to potentially roll back a transaction
                logger.error(`Stock level went negative: Prod ${productId}@Loc ${locationId}. Change: ${quantityChange}, NewQty: ${result.quantity}`);
                throw new ConflictError(
                    `Insufficient stock for ${result.product.name} (SKU: ${result.product.sku}) at location ID ${locationId}. Required change: ${quantityChange}, Available: ${result.quantity - quantityChange}`,
                );
            }

            // Check for crossing reorder level threshold
            const oldQuantity = result.quantity - quantityChange;
            if (
                result.product.reorderLevel > 0 && // Only if reorder level is set
                result.quantity <= result.product.reorderLevel && // Current is below or at threshold
                oldQuantity > result.product.reorderLevel // Previous was above threshold
            ) {
                logger.info(
                    `LOW STOCK ALERT: Product ${result.product.name} (SKU: ${result.product.sku}) at Loc ${locationId} reached ${result.quantity} (Reorder level: ${result.product.reorderLevel})`,
                );
                // Check for crossing reorder level threshold
                const oldQuantity = result.quantity - quantityChange;
                if (
                    result.product.reorderLevel > 0 && // Only if reorder level is set
                    result.quantity <= result.product.reorderLevel && // Current is below or at threshold
                    oldQuantity > result.product.reorderLevel // Previous was above threshold
                ) {
                    logger.info(
                        `LOW STOCK ALERT Trigger: Product ${result.product.name} (SKU: ${result.product.sku}) at Loc ${locationId} reached ${result.quantity} (Reorder level: ${result.product.reorderLevel})`,
                    );
                    // Call notification service helper (async but don't wait for it - fire and forget usually)
                    notificationService
                        .createLowStockNotification(
                            result.product,
                            result.locationId,
                            result.quantity,
                            prismaClient, // Pass tx if in transaction
                        )
                        .catch((err: unknown) => logger.error("Failed to create low stock notification", err)); // Catch potential errors from the notification creation itself
                }
            }

            return result; // Return the result including the product relation
        } catch (error) {
            // Catch known errors like Foreign Key violation if Product/Location doesn't exist
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2003") {
                    // Foreign key constraint failed
                    // Determine if product or location was the cause (requires checking which field failed if DB returns that info)
                    logger.warn(`Foreign key constraint failed during stock upsert: ${error.meta?.field_name}`); // Check Prisma error meta if available
                    throw new NotFoundError(`Product or Location involved in stock adjustment not found.`); // Generic error if field unknown
                }
                // P2002 Unique constraint failed (Shouldn't happen with upsert's logic, but defensive)
                if (error.code === "P2002") {
                    logger.error(`Unique constraint violation during stock upsert - investigate logic. Meta: ${JSON.stringify(error.meta)}`);
                    throw new ConflictError("Stock level unique constraint failed unexpectedly.");
                }
            }
            // Re-throw other errors (including our ConflictError for negative stock)
            throw error;
        }
    },

    /**
     * Retrieves stock levels based on query parameters.
     * Uses $queryRaw for the complex 'belowReorder' filter.
     * @param queryParams Filters for productId, locationId, belowReorder, etc.
     * @returns Paginated list of stock levels.
     */
    async getStockLevels(queryParams?: GetStockLevelQueryInput) {
        const {
            page = 1,
            limit = 10,
            productId,
            locationId,
            belowReorder, // The critical flag
            searchProduct,
        } = queryParams || {};
        const skip = calculateSkip(page, limit);

        // --- If NOT filtering by belowReorder, use the standard Prisma query ---
        if (belowReorder !== true) {
            const where: Prisma.StockLevelWhereInput = {};
            if (productId) where.productId = productId;
            if (locationId) where.locationId = locationId;

            if (searchProduct) {
                where.product = {
                    OR: [{ name: { contains: searchProduct } }, { sku: { contains: searchProduct } }],
                };
            }

            const [stockLevels, totalCount] = await prisma.$transaction([
                prisma.stockLevel.findMany({
                    where,
                    include: {
                        product: { select: { id: true, name: true, sku: true, unit: true, reorderLevel: true } },
                        location: { select: { id: true, name: true } },
                    },
                    skip: skip,
                    take: limit,
                    orderBy: [{ product: { name: "asc" } }, { location: { name: "asc" } }],
                }),
                prisma.stockLevel.count({ where }),
            ]);

            const paginationData = getPaginationData(totalCount, page, limit);
            return {
                data: stockLevels,
                pagination: paginationData,
            };
        }

        // --- If filtering by belowReorder === true, use $queryRaw ---
        else {
            logger.debug("Using $queryRaw for getStockLevels with belowReorder filter");

            const conditions: Prisma.Sql[] = [Prisma.sql`sl."quantity" <= p."reorderLevel"`, Prisma.sql`p."reorderLevel" > 0`];
            const countConditions: Prisma.Sql[] = [Prisma.sql`sl."quantity" <= p."reorderLevel"`, Prisma.sql`p."reorderLevel" > 0`];

            if (productId) {
                conditions.push(Prisma.sql`sl."productId" = ${productId}::uuid`); // Assuming UUID type, adjust cast if needed
                countConditions.push(Prisma.sql`sl."productId" = ${productId}::uuid`);
            }
            if (locationId) {
                conditions.push(Prisma.sql`sl."locationId" = ${locationId}::uuid`);
                countConditions.push(Prisma.sql`sl."locationId" = ${locationId}::uuid`);
            }
            if (searchProduct) {
                const searchPattern = `%${searchProduct}%`; // Prepare pattern for LIKE/ILIKE
                // Use ILIKE for case-insensitivity (PostgreSQL) or LOWER() for wider compatibility
                const searchSql = Prisma.sql`(p."name" ILIKE ${searchPattern} OR p."sku" ILIKE ${searchPattern})`;
                conditions.push(searchSql);
                countConditions.push(searchSql);
            }

            const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
            const countWhereClause = countConditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(countConditions, " AND ")}` : Prisma.empty;

            // 1. Get the total count matching the raw criteria
            const countQuery = Prisma.sql`
                SELECT COUNT(*)
                FROM "StockLevel" sl
                JOIN "Product" p ON sl."productId" = p."id"
                ${countWhereClause}
            `;
            // Type assertion needed because count result is complex { count: bigint }[] or similar
            const countResult = await prisma.$queryRaw<{ count: bigint }[]>(countQuery);
            const totalCount = Number(countResult[0]?.count || 0);

            if (totalCount === 0) {
                return {
                    data: [],
                    pagination: getPaginationData(0, page, limit),
                };
            }

            // 2. Get the paginated data using the raw criteria
            const dataQuery = Prisma.sql`
                SELECT
                    sl."id", sl."productId", sl."locationId", sl."quantity", sl."lastUpdated",
                    p."id" as product_id, p."name" as product_name, p."sku" as product_sku, p."unit" as product_unit, p."reorderLevel" as product_reorderLevel,
                    l."id" as location_id, l."name" as location_name
                FROM "StockLevel" sl
                JOIN "Product" p ON sl."productId" = p."id"
                JOIN "Location" l ON sl."locationId" = l."id"
                ${whereClause}
                ORDER BY p."name" ASC, l."name" ASC -- Match ordering if possible
                LIMIT ${limit}
                OFFSET ${skip}
            `;

            const rawResults = await prisma.$queryRaw<RawStockLevelResult[]>(dataQuery);

            // 3. Map raw results back to a more ORM-like structure (optional but good practice)
            const formattedData = rawResults.map((r) => ({
                id: r.id,
                productId: r.productId,
                locationId: r.locationId,
                quantity: r.quantity,
                lastUpdated: r.lastUpdated,
                // De-alias joined data into nested objects
                product: {
                    id: r.product.id,
                    name: r.product.name,
                    sku: r.product.sku,
                    unit: r.product.unit,
                    reorderLevel: r.product.reorderLevel,
                },
                location: {
                    id: r.location.id,
                    name: r.location.name,
                },
            }));

            const paginationData = getPaginationData(totalCount, page, limit);

            return {
                data: formattedData,
                pagination: paginationData,
            };
        }
    },

    /**
     * Gets stock level for a specific product at a specific location.
     * Standard ORM query is fine here.
     * @param productId
     * @param locationId
     * @returns The specific stock level record or null if not found.
     */
    async getStockLevel(productId: string, locationId: string): Promise<StockLevel | null> {
        return prisma.stockLevel.findUnique({
            where: {
                productId_locationId: { productId, locationId },
            },
            include: {
                product: { select: { id: true, name: true, sku: true, unit: true, reorderLevel: true } },
                location: { select: { id: true, name: true } },
            },
        });
    },

    /**
     * Retrieves a list of products that are at or below their reorder level using $queryRaw.
     * @param queryParams Optional filtering (e.g., by location) and pagination.
     * @returns Paginated list of low stock items including product and location info.
     */
    async getLowStockProducts(queryParams?: GetLowStockQueryInput) {
        const { page = 1, limit = 10, locationId } = queryParams || {};
        const skip = calculateSkip(page, limit);

        const conditions: Prisma.Sql[] = [Prisma.sql`sl."quantity" <= p."reorderLevel"`, Prisma.sql`p."reorderLevel" > 0`];
        const countConditions: Prisma.Sql[] = [Prisma.sql`sl."quantity" <= p."reorderLevel"`, Prisma.sql`p."reorderLevel" > 0`];

        if (locationId) {
            conditions.push(Prisma.sql`sl."locationId" = ${locationId}::uuid`);
            countConditions.push(Prisma.sql`sl."locationId" = ${locationId}::uuid`);
        }

        const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, "AND")}` : Prisma.empty;
        const countWhereClause = countConditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(countConditions, "AND")}` : Prisma.empty;

        // 1. Count query
        const countQuery = Prisma.sql`
                SELECT COUNT(*)
                FROM "StockLevel" sl
                JOIN "Product" p ON sl."productId" = p."id"
                ${countWhereClause}
            `;
        const countResult = await prisma.$queryRaw<{ count: bigint }[]>(countQuery);
        const totalCount = Number(countResult[0]?.count || 0);

        if (totalCount === 0) {
            return { data: [], pagination: getPaginationData(0, page, limit) };
        }

        // 2. Data query (fetch similar fields as before)
        const dataQuery = Prisma.sql`
                SELECT
                    sl."id", sl."productId", sl."locationId", sl."quantity", sl."lastUpdated",
                    p."id" as product_id, p."name" as product_name, p."sku" as product_sku, p."unit" as product_unit, p."reorderLevel" as product_reorderLevel, p."description" as product_description, p."costPrice" as product_costPrice, p."sellingPrice" as product_sellingPrice, p."imageUrl" as product_imageUrl, p."createdAt" as product_createdAt, p."updatedAt" as product_updatedAt, p."categoryId" as product_categoryId, -- Added more product fields
                    l."id" as location_id, l."name" as location_name
                FROM "StockLevel" sl
                JOIN "Product" p ON sl."productId" = p."id"
                JOIN "Location" l ON sl."locationId" = l."id"
                ${whereClause}
                ORDER BY p."name" ASC, l."name" ASC
                LIMIT ${limit}
                OFFSET ${skip}
            `;

        // Re-use the RawStockLevelResult interface or create a new one if fields differ significantly
        const rawResults = await prisma.$queryRaw<RawStockLevelResult[]>(dataQuery);

        // 3. Map raw results (Adjust based on selected fields)
        const formattedData = rawResults.map((r) => ({
            // StockLevel fields
            id: r.id,
            productId: r.productId,
            locationId: r.locationId,
            quantity: r.quantity,
            lastUpdated: r.lastUpdated,
            // Nested Product object
            product: {
                id: r.productId,
                name: r.product.name,
                sku: r.product.sku,
                unit: r.product.unit,
                reorderLevel: r.product.reorderLevel,
                description: r.product.description, // Added fields
                costPrice: r.product.costPrice,
                sellingPrice: r.product.sellingPrice,
                imageUrl: r.product.imageUrl,
                createdAt: r.product.createdAt,
                updatedAt: r.product.updatedAt,
                categoryId: r.product.categoryId,
            },
            // Nested Location object
            location: {
                id: r.location.id,
                name: r.location.name,
            },
        }));

        const paginationData = getPaginationData(totalCount, page, limit);

        return {
            data: formattedData,
            pagination: paginationData,
        };
    },
};
