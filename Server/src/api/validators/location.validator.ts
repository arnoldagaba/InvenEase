import { z } from "zod";

// Schema for creating a new location
export const createLocationSchema = z.object({
    body: z
        .object({
            name: z.string().min(1, { message: "Location name cannot be empty" }).max(255),
            address: z.string().max(1024).optional(), // Adjusted max length for address
            description: z.string().max(2048).optional(), // Adjusted max length for description
        })
        .strict(), // Prevent unexpected fields in body
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>["body"];

// Schema for updating an existing location (all fields optional)
export const updateLocationSchema = z.object({
    params: z.object({
        id: z.string().uuid({ message: "Invalid location ID format" }),
    }),
    body: z
        .object({
            name: z.string().min(1).max(255).optional(),
            address: z.string().max(1024).nullish(), // Allow setting to null
            description: z.string().max(2048).nullish(), // Allow setting to null
        })
        .strict()
        .refine((data) => Object.keys(data).length > 0, {
            message: "At least one field must be provided for update", // Ensure body isn't empty
        }),
});
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>["body"];

// Schema just for validating the location ID in parameters (e.g., for GET by ID, DELETE)
export const locationIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid({ message: "Invalid location ID format" }),
    }),
});
export type LocationIdParamInput = z.infer<typeof locationIdParamSchema>["params"];

// Optional: Schema for query parameters when getting all locations (e.g., pagination, search)
export const getLocationQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(), // Allow string, convert to number
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            search: z.string().optional(), // Simple text search
            // Add other filters if needed (e.g., sortBy, sortOrder)
        })
        .strict(),
});
export type GetLocationQueryInput = z.infer<typeof getLocationQuerySchema>["query"];
