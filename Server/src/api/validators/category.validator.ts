import { z } from "zod";

// Schema for validating the ID in params
export const categoryIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid category ID format"),
    }),
});
export type CategoryIdParams = z.infer<typeof categoryIdSchema>["params"];

// Schema for creating a category
export const createCategorySchema = z.object({
    body: z
        .object({
            name: z.string().min(1, "Category name is required"),
            description: z.string().optional(),
        })
        .strict(), // Disallow extra fields
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];

// Schema for updating a category
export const updateCategorySchema = z.object({
    params: categoryIdSchema.shape.params, // Validate UUID in URL param
    body: z
        .object({
            name: z.string().min(1, "Category name cannot be empty").optional(),
            description: z.string().optional().nullable(), // Allow setting description to null
        })
        .strict()
        .refine((data) => Object.keys(data).length > 0, {
            message: "Request body cannot be empty. Please provide fields to update.",
        }),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];

// Optional: Schema for listing categories (add pagination/filtering later if needed)
export const listCategoriesSchema = z.object({
    query: z
        .object({
            // Add query params like page, limit, sortBy, etc. here if needed
            search: z.string().optional(),
        })
        .optional(), // Make the whole query object optional if no params are mandatory
});
export type ListCategoriesQuery = z.infer<typeof listCategoriesSchema>["query"];
