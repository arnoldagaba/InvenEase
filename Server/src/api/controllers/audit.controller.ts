import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { auditLogService } from "@/api/services/audit.service.ts";
import { GetAuditLogQueryInput } from "@/api/validators/audit.validator.ts";

export const auditController = {
    /**
     * Handles request to get audit logs based on query parameters.
     */
    async handleGetAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Ensure user has Admin role (done via middleware)
            const queryParams: GetAuditLogQueryInput | undefined = req.validatedData?.query;

            const result = await auditLogService.getAuditLogs(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error); // Pass errors to global handler
        }
    },
};
