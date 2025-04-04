import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { supplierService } from "@/api/services/supplier.service.ts";
import { GetSupplierQueryInput } from "@/api/validators/supplier.validator.ts";
import { BadRequestError } from "@/errors/index.ts";

export const supplierController = {
    async handleCreateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const supplierData = req.validatedData?.body;
            if (!supplierData || !req.user?.userId) {
                next(new BadRequestError("Validated data or user ID missing."));
                return;
            }

            const newSupplier = await supplierService.createSupplier(supplierData, req.user.userId);
            res.status(StatusCodes.CREATED).json(newSupplier);
        } catch (error) {
            next(error);
        }
    },

    async handleGetAllSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetSupplierQueryInput | undefined = req.validatedData?.query;
            const result = await supplierService.getAllSuppliers(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },

    async handleGetSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Validated
            const supplier = await supplierService.getSupplierById(id);
            res.status(StatusCodes.OK).json(supplier);
        } catch (error) {
            next(error);
        }
    },

    async handleUpdateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const supplierData = req.validatedData?.body;
            if (!supplierData || !req.user?.userId) {
                next(new BadRequestError("Validated data or user ID missing."));
                return;
            }

            const updatedSupplier = await supplierService.updateSupplier(id, supplierData, req.user.userId);
            res.status(StatusCodes.OK).json(updatedSupplier);
        } catch (error) {
            next(error);
        }
    },

    async handleDeleteSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!req.user?.userId) {
                next(new BadRequestError("User ID missing."));
                return;
            }

            await supplierService.deleteSupplier(id, req.user.userId);
            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            next(error);
        }
    },
};
