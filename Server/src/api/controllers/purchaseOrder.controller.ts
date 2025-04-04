import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { purchaseOrderService } from "@/api/services/purchaseOrder.service.ts";
import {
    GetPurchaseOrderQueryInput,
    ReceivePurchaseOrderItemInput,
    ReceivePurchaseOrderItemParams,
    UpdatePurchaseOrderStatusInput,
} from "@/api/validators/purchaseOrder.validator.ts";
import { BadRequestError } from "@/errors/index.ts";

export const purchaseOrderController = {
    async handleCreatePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const poData = req.validatedData?.body;
            if (!poData || !req.user?.userId) {
                next(new BadRequestError("Validated PO data or user ID missing."));
                return;
            }
            const newPO = await purchaseOrderService.createPurchaseOrder(req.user.userId, poData);
            res.status(StatusCodes.CREATED).json(newPO);
        } catch (error) {
            next(error);
        }
    },

    async handleGetPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetPurchaseOrderQueryInput | undefined = req.validatedData?.query;
            const result = await purchaseOrderService.getPurchaseOrders(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },

    async handleGetPurchaseOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Validated
            const po = await purchaseOrderService.getPurchaseOrderById(id);
            res.status(StatusCodes.OK).json(po);
        } catch (error) {
            next(error);
        }
    },

    async handleUpdatePurchaseOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Validated
            const updateData: UpdatePurchaseOrderStatusInput | undefined = req.validatedData?.body;

            if (!updateData || !req.user?.userId) {
                next(new BadRequestError("Validated status data or user ID missing."));
                return;
            }

            const updatedPO = await purchaseOrderService.updatePurchaseOrderStatus(id, updateData.status, updateData.notes, req.user.userId);
            res.status(StatusCodes.OK).json(updatedPO);
        } catch (error) {
            next(error);
        }
    },

    async handleReceivePurchaseOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // req.params and req.body are validated by middleware into structured objects
            const params: ReceivePurchaseOrderItemParams = req.validatedData?.params;
            const body: ReceivePurchaseOrderItemInput = req.validatedData?.body;

            if (!params || !body || !req.user?.userId) {
                next(new BadRequestError("Validated receipt data (params/body) or user ID missing."));
                return;
            }

            // Pass parsed params and body to the service
            const updatedItem = await purchaseOrderService.receivePurchaseOrderItem(params, body, req.user.userId);

            // Respond with the updated item or a success message
            // Returning the updated item can be useful for the frontend
            res.status(StatusCodes.OK).json(updatedItem);
        } catch (error) {
            next(error); // Let global handler manage response
        }
    },
};
