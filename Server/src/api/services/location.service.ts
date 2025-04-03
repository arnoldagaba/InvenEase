import prisma from "@/config/prisma.ts";
import { Prisma, Location } from "@prisma/client";
import { NotFoundError, ConflictError } from "@/errors/index.ts";
import { CreateLocationInput, UpdateLocationInput, GetLocationQueryInput } from "@/api/validators/location.validator.ts";

export type PaginatedLocationResult = {
    data: Location[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
};

export const locationService = {
    /**
     * Creates a new location, checking for name conflicts.
     * @param data - Input data containing name and optional fields.
     * @returns The newly created location.
     * @throws ConflictError if a location with the same name already exists.
     */
    async createLocation(data: CreateLocationInput): Promise<Location> {
        // Check for existing location with the same name (case-insensitive check is often useful)
        const existingLocation = await prisma.location.findUnique({
            where: { name: data.name }, // Prisma name unique constraint handles case sensitivity based on DB collation
        });

        if (existingLocation) {
            throw new ConflictError(`Location with name "${data.name}" already exists.`);
        }

        const newLocation = await prisma.location.create({
            data: {
                name: data.name,
                address: data.address,
                description: data.description,
            },
        });
        return newLocation;
    },

    /**
     * Retrieves all locations with optional search and pagination.
     * @param queryParams - Optional query parameters for pagination and search.
     * @returns A list of locations and pagination metadata.
     */
    async getAllLocations(queryParams?: GetLocationQueryInput): Promise<PaginatedLocationResult> {
        const page = Math.max(1, queryParams?.page || 1);
        const limit = queryParams?.limit || 1;
        const search = queryParams?.search?.trim();
        const skip = (page - 1) * limit;

        let where: Prisma.LocationWhereInput = {};
        if (search) {
            where = {
                OR: [{ name: { contains: search } }, { address: { contains: search } }, { description: { contains: search } }],
            };
        }

        const [locations, totalCount] = await prisma.$transaction([
            prisma.location.findMany({
                where,
                skip: skip,
                take: limit,
                orderBy: { name: "asc" }, // Default ordering
            }),
            prisma.location.count({ where }),
        ]);

        return {
            data: locations,
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
        };
    },

    /**
     * Retrieves a single location by its ID.
     * @param id - The UUID of the location.
     * @returns The location object.
     * @throws NotFoundError if the location is not found.
     */
    async getLocationById(id: string): Promise<Location> {
        const location = await prisma.location.findUnique({
            where: { id },
        });

        if (!location) {
            throw new NotFoundError(`Location with ID "${id}" not found.`);
        }
        return location;
    },

    /**
     * Updates an existing location by ID.
     * Checks for name conflicts if the name is being changed.
     * @param id - The UUID of the location to update.
     * @param data - The data to update.
     * @returns The updated location object.
     * @throws NotFoundError if the location is not found.
     * @throws ConflictError if updating to a name that already exists (for a different location).
     */
    async updateLocation(id: string, data: UpdateLocationInput): Promise<Location> {
        // 1. Ensure the location exists
        const existingLocation = await prisma.location.findUnique({
            where: { id },
        });

        if (!existingLocation) {
            throw new NotFoundError(`Location with ID "${id}" not found.`);
        }

        // 2. Check for name conflict only if name is provided and different from current name
        if (data.name && data.name !== existingLocation.name) {
            const conflictingLocation = await prisma.location.findUnique({
                where: { name: data.name },
            });
            // If a location with the new name exists AND it's not the one we're currently updating
            if (conflictingLocation && conflictingLocation.id !== id) {
                throw new ConflictError(`Another location with name "${data.name}" already exists.`);
            }
        }

        // 3. Perform the update
        const updatedLocation = await prisma.location.update({
            where: { id },
            data: {
                name: data.name ?? existingLocation.name, // Use existing if not provided
                address: data.address, // Allows setting to null explicitly
                description: data.description, // Allows setting to null explicitly
            },
        });

        return updatedLocation;
    },

    /**
     * Deletes a location by its ID.
     * Note: Consider business logic - prevent deletion if stock exists at this location?
     * Prisma schema has relations, but deletion might fail if related records exist
     * depending on onDelete rules (currently relies on DB-level cascade for StockLevel).
     * Might need a check here before deleting.
     * @param id - The UUID of the location to delete.
     * @returns The deleted location object.
     * @throws NotFoundError if the location is not found.
     * @throws ConflictError (or other custom error) if deletion is blocked by dependencies.
     */
    async deleteLocation(id: string): Promise<Location> {
        // **IMPORTANT**: Check for dependencies before deleting.
        // For example, check if any StockLevel records exist for this location.
        const stockCount = await prisma.stockLevel.count({
            where: { locationId: id },
        });

        if (stockCount > 0) {
            // Or use a more specific custom error
            throw new ConflictError(`Cannot delete location ID "${id}". Stock levels still exist at this location.`);
        }

        // Optionally check for pending transactions TO/FROM this location if that's critical

        try {
            const deletedLocation = await prisma.location.delete({
                where: { id },
            });
            return deletedLocation; // Return the deleted object if successful
        } catch (error) {
            // Catch potential Prisma errors (e.g., if deletion fails despite checks due to races or other constraints)
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                // P2025: Record to delete does not exist.
                if (error.code === "P2025") {
                    throw new NotFoundError(`Location with ID "${id}" not found.`);
                }
                // P2003: Foreign key constraint failed (less likely with the explicit check above, but possible)
                if (error.code === "P2003") {
                    throw new ConflictError(`Cannot delete location ID "${id}" due to existing related records (e.g., transactions).`);
                }
            }
            // Re-throw unexpected errors
            throw error;
        }
    },
};
