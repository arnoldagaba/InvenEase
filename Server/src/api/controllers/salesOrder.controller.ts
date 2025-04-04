import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { salesOrderService } from "@/api/services/salesOrder.service.ts";
import {
    GetSalesOrderQueryInput,
    UpdateSalesOrderStatusInput,
    ShipSalesOrderItemInput,
    ShipSalesOrderItemParams,
} from "@/api/validators/salesOrder.validator.ts";
import { BadRequestError } from "@/errors/index.ts";

export const salesOrderController = {
    async handleCreateSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const soData = req.validatedData?.body;
            if (!soData || !req.user?.userId) {
                next(new BadRequestError("Validated SO data or user ID missing."));
                return;
            }
            const newSO = await salesOrderService.createSalesOrder(req.user.userId, soData);
            res.status(StatusCodes.CREATED).json(newSO);
        } catch (error) {
            next(error);
        }
    },

    async handleGetSalesOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetSalesOrderQueryInput | undefined = req.validatedData?.query;
            const result = await salesOrderService.getSalesOrders(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },

    async handleGetSalesOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Validated
            const so = await salesOrderService.getSalesOrderById(id);
            res.status(StatusCodes.OK).json(so);
        } catch (error) {
            next(error);
        }
    },

    async handleUpdateSalesOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Validated
            const updateData: UpdateSalesOrderStatusInput | undefined = req.validatedData?.body;

            if (!updateData || !req.user?.userId) {
                next(new BadRequestError("Validated status data or user ID missing."));
                return;
            }

            const updatedSO = await salesOrderService.updateSalesOrderStatus(id, updateData, req.user.userId);
            res.status(StatusCodes.OK).json(updatedSO);
        } catch (error) {
            next(error);
        }
    },

    async handleShipSalesOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const params: ShipSalesOrderItemParams = req.validatedData?.params;
            const body: ShipSalesOrderItemInput = req.validatedData?.body;

            if (!params || !body || !req.user?.userId) {
                next(new BadRequestError("Validated shipment data (params/body) or user ID missing."));
                return;
            }

            const updatedItem = await salesOrderService.shipSalesOrderItem(params, body, req.user.userId);
            res.status(StatusCodes.OK).json(updatedItem); // Respond with the updated line item
        } catch (error) {
            next(error); // Global handler takes care of insufficient stock errors etc.
        }
    },
};
