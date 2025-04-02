import { Prisma, Category } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { StatusCodes } from "http-status-codes";
import { ApiError, ConflictError, NotFoundError } from "@/errors/index.ts";
import logger from "@/config/logger.ts";
import { CreateCategoryInput, UpdateCategoryInput, ListCategoriesQuery } from "@/api/validators/category.validator.ts";

class CategoryService {
    async createCategory(data: CreateCategoryInput): Promise<Category> {
        const existing = await prisma.category.findUnique({ where: { name: data.name } });
        if (existing) {
            throw new ConflictError(`Category with name "${data.name}" already exists.`);
        }

        try {
            const category = await prisma.category.create({ data });
            logger.info(`Category created: ${category.id} - ${category.name}`);
            return category;
        } catch (error) {
            logger.error("Error creating category:", error);
            // Handle potential Prisma errors if needed, though conflict is checked above
            throw new ApiError("Could not create category.", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    async getCategoryById(id: string): Promise<Category> {
        const category = await prisma.category.findUnique({ where: { id } });
        if (!category) {
            throw new NotFoundError(`Category with ID ${id} not found.`);
        }
        return category;
    }

    async listCategories(query?: ListCategoriesQuery): Promise<Category[]> {
        const where: Prisma.CategoryWhereInput = {};
        if (query?.search) {
            where.OR = [{ name: { contains: query.search } }, { description: { contains: query.search } }];
        }

        try {
            // Add pagination/sorting here later if needed based on query
            const categories = await prisma.category.findMany({
                where,
                orderBy: { name: "asc" }, // Default sort by name
            });
            return categories;
        } catch (error) {
            logger.error("Error listing categories:", error);
            throw new ApiError("Could not retrieve categories.", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    async updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
        // 1. Ensure the category exists
        const existingCategory = await this.getCategoryById(id); // Throws NotFoundError if not found

        // 2. Check for name conflict if name is being changed
        if (data.name && data.name !== existingCategory.name) {
            const conflicting = await prisma.category.findUnique({ where: { name: data.name } });
            if (conflicting) {
                throw new ConflictError(`Category with name "${data.name}" already exists.`);
            }
        }

        // 3. Perform the update
        try {
            const updatedCategory = await prisma.category.update({
                where: { id },
                data,
            });
            logger.info(`Category updated: ${updatedCategory.id} - ${updatedCategory.name}`);
            return updatedCategory;
        } catch (error) {
            logger.error(`Error updating category ${id}:`, error);
            // Handle potential Prisma errors (like P2025 if category disappeared between check and update)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                throw new NotFoundError(`Category with ID ${id} not found during update.`);
            }
            throw new ApiError(`Could not update category ${id}.`, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    async deleteCategory(id: string): Promise<void> {
        // 1. Ensure the category exists before attempting delete
        await this.getCategoryById(id); // Throws NotFoundError if not found

        try {
            // Note: Prisma's `onDelete: SetNull` on Product.categoryId handles relationship cleanup.
            await prisma.category.delete({ where: { id } });
            logger.info(`Category deleted: ${id}`);
        } catch (error) {
            logger.error(`Error deleting category ${id}:`, error);
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                throw new NotFoundError(`Category with ID ${id} not found during delete.`);
            }
            // Handle other potential errors if necessary
            throw new ApiError(`Could not delete category ${id}.`, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}

export default new CategoryService();
