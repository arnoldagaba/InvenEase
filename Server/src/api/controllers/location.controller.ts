import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { locationService } from "@/api/services/location.service.ts";
import { GetLocationQueryInput } from "@/api/validators/location.validator.ts";

export const locationController = {
    /**
     * Handles request to create a new location.
     */
    async handleCreateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const locationData = req.validatedData?.body; // Assumes validateRequest middleware populates this
            if (!locationData) {
                // Should be caught by validation middleware, but defensive check
                next(new Error("Validated location data missing from request."));
                return;
            }

            const newLocation = await locationService.createLocation(locationData);
            res.status(StatusCodes.CREATED).json(newLocation);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to get all locations with filtering and pagination.
     */
    async handleGetAllLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Get validated query params if validation middleware is used
            const queryParams: GetLocationQueryInput | undefined = req.validatedData?.query;

            const result = await locationService.getAllLocations(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to get a single location by ID.
     */
    async handleGetLocationById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const location = await locationService.getLocationById(id);
            res.status(StatusCodes.OK).json(location);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to update a location by ID.
     */
    async handleUpdateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Validated
            const locationData = req.validatedData?.body; // Validated
            if (!locationData) {
                return next(new Error("Validated location update data missing from request."));
            }

            const updatedLocation = await locationService.updateLocation(id, locationData);
            res.status(StatusCodes.OK).json(updatedLocation);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to delete a location by ID.
     */
    async handleDeleteLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Validated
            await locationService.deleteLocation(id); // Service throws NotFoundError if it doesn't exist
            res.status(StatusCodes.NO_CONTENT).send(); // Standard practice for successful DELETE
        } catch (error) {
            next(error);
        }
    },
};
