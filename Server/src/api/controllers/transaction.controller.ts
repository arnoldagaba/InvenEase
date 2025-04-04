import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { transactionService } from "@/api/services/transaction.service.ts";
import { GetTransactionQueryInput } from "@/api/validators/transaction.validator.ts";
import { BadRequestError } from "@/errors/index.ts";

export const transactionController = {
    /**
     * Handles request to record a stock adjustment.
     */
    async handleRecordAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const adjustmentData = req.validatedData?.body;
            if (!adjustmentData) {
                next(new BadRequestError("Validated adjustment data missing."));
                return;
            }
            // Ensure req.user exists from authenticateToken middleware
            if (!req.user?.userId) {
                next(new Error("User ID missing from authenticated request.")); // Should not happen
                return;
            }

            const newTransaction = await transactionService.recordAdjustment(req.user.userId, adjustmentData);
            res.status(StatusCodes.CREATED).json(newTransaction);
        } catch (error) {
            next(error); // Pass errors to global handler
        }
    },

    /**
     * Handles request to record an inventory transfer.
     */
    async handleRecordTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const transferData = req.validatedData?.body;
            if (!transferData) {
                next(new BadRequestError("Validated transfer data missing."));
                return;
            }
            if (!req.user?.userId) {
                next(new Error("User ID missing from authenticated request."));
                return;
            }

            // The service returns both transactions, decide how to represent in response
            const { outTx, inTx } = await transactionService.recordTransfer(req.user.userId, transferData);
            // Option 1: Return both
            // res.status(StatusCodes.CREATED).json({ transferOut: outTx, transferIn: inTx });
            // Option 2: Return a confirmation message or a summary ID if needed
            res.status(StatusCodes.CREATED).json({ message: "Transfer recorded successfully", transactionIds: [outTx.id, inTx.id] });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to get transaction history.
     */
    async handleGetTransactionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetTransactionQueryInput | undefined = req.validatedData?.query;
            const result = await transactionService.getTransactionHistory(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },
};
