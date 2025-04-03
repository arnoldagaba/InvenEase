import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticateToken } from "@/api/middleware/auth.middleware.ts";
import { authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";

// Import validators and controller
import { createLocationSchema, updateLocationSchema, locationIdParamSchema, getLocationQuerySchema } from "@/api/validators/location.validator.ts";
import { locationController } from "@/api/controllers/location.controller.ts";

const router = Router();

// --- Location Routes ---

// POST /api/locations - Create a new location (Admin/Manager only)
router.post(
    "/",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(createLocationSchema),
    locationController.handleCreateLocation,
);

// GET /api/locations - Get all locations (All authenticated users)
router.get("/", authenticateToken, validateRequest(getLocationQuerySchema), locationController.handleGetAllLocations);

// GET /api/locations/:id - Get a single location by ID (All authenticated users)
router.get("/:id", authenticateToken, validateRequest(locationIdParamSchema), locationController.handleGetLocationById);

// PUT /api/locations/:id - Update a location by ID (Admin/Manager only)
router.put(
    "/:id",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(updateLocationSchema),
    locationController.handleUpdateLocation,
);

// DELETE /api/locations/:id - Delete a location by ID (Admin only)
router.delete(
    "/:id",
    authenticateToken,
    authorizeRole([UserRole.ADMIN]),
    validateRequest(locationIdParamSchema),
    locationController.handleDeleteLocation,
);

export default router;
