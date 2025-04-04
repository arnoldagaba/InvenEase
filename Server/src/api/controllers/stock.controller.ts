import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { stockService } from "@/api/services/stock.service.ts";
import { GetStockLevelQueryInput, GetLowStockQueryInput } from "@/api/validators/stock.validator.ts";
import { NotFoundError } from "@/errors/index.ts";

export const stockController = {
    /**
     * Handles request to get stock levels with filtering and pagination.
     */
    async handleGetStockLevels(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetStockLevelQueryInput | undefined = req.validatedData?.query;
            const result = await stockService.getStockLevels(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to get stock for a specific Product/Location combination.
     */
    async handleGetSpecificStockLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Assuming productId and locationId are passed as query params and validated
            const { productId, locationId } = req.validatedData?.query as { productId?: string; locationId?: string };

            if (!productId || !locationId) {
                res.status(StatusCodes.BAD_REQUEST).json({ error: { message: "Both productId and locationId query parameters are required." } });
                return;
            }

            const stockLevel = await stockService.getStockLevel(productId, locationId);

            if (!stockLevel) {
                // Return 404 or an object indicating zero stock if preferred
                throw new NotFoundError(`Stock level not found for product ${productId} at location ${locationId}.`);
                // Alternative: return default zero-stock object
                // You might want to fetch Product/Location names separately if returning this
                // res.status(StatusCodes.OK).json({
                //     productId,
                //     locationId,
                //     quantity: 0,
                //     lastUpdated: null, // Or a relevant timestamp
                //     product: { name: "N/A" /* Fetch if needed */ },
                //     location: { name: "N/A" /* Fetch if needed */ },
                // });
                // return;
            }

            res.status(StatusCodes.OK).json(stockLevel);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to get products that are below their reorder level.
     */
    async handleGetLowStock(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetLowStockQueryInput | undefined = req.validatedData?.query;
            const result = await stockService.getLowStockProducts(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },
};
