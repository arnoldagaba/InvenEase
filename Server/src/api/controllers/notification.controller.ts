import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { notificationService } from "@/api/services/notification.service.ts";
import { GetNotificationQueryInput } from "@/api/validators/notification.validator.ts";
import { BadRequestError } from "@/errors/index.ts";

export const notificationController = {
    /**
     * Handles request to get the current user's notifications.
     */
    async handleGetUserNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetNotificationQueryInput | undefined = req.validatedData?.query;
            if (!req.user?.userId) {
                return next(new BadRequestError("User context missing from request."));
            }

            const result = await notificationService.getUserNotifications(req.user.userId, queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to mark a specific notification as read for the current user.
     */
    async handleMarkNotificationAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id: notificationId } = req.params; // Validated ID from params
            if (!req.user?.userId) {
                return next(new BadRequestError("User context missing from request."));
            }
            if (!notificationId) {
                return next(new BadRequestError("Notification ID missing from parameters."));
            }

            const updatedNotification = await notificationService.markNotificationAsRead(notificationId, req.user.userId);
            res.status(StatusCodes.OK).json(updatedNotification);
        } catch (error) {
            // Let global handler deal with NotFoundError etc.
            next(error);
        }
    },

    /**
     * Handles request to mark all of the current user's notifications as read.
     */
    async handleMarkAllNotificationsAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            if (!req.user?.userId) {
                return next(new BadRequestError("User context missing from request."));
            }

            const result = await notificationService.markAllNotificationsAsRead(req.user.userId);
            // Respond with the count of items marked as read
            res.status(StatusCodes.OK).json({ message: `Marked ${result.count} notifications as read.` });
        } catch (error) {
            next(error);
        }
    },
};
