import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import categoryService from "@/api/services/category.service.ts";
import { CreateCategoryInput, UpdateCategoryInput, ListCategoriesQuery } from "@/api/validators/category.validator.ts";
import { ApiError } from "@/errors/index.ts";
import logger from "@/config/logger.ts";

class CategoryController {
    async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const validatedBody = req.validatedData?.body as CreateCategoryInput;
            if (!validatedBody) {
                logger.error("Validated body missing in createCategory");
                next(new ApiError("Internal processing error.", StatusCodes.INTERNAL_SERVER_ERROR));
                return;
            }

            const category = await categoryService.createCategory(validatedBody);
            res.status(StatusCodes.CREATED).json(category);
        } catch (error) {
            next(error);
        }
    }

    async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Optional: Get validated query params if listCategoriesSchema is used
            const validatedQuery = req.validatedData?.query as ListCategoriesQuery | undefined;
            const categories = await categoryService.listCategories(validatedQuery);
            res.status(StatusCodes.OK).json(categories);
        } catch (error) {
            next(error);
        }
    }

    async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const validatedParams = req.validatedData?.params as { id: string };
            if (!validatedParams?.id) {
                logger.error("Validated params missing in getCategoryById");
                next(new ApiError("Internal processing error.", StatusCodes.INTERNAL_SERVER_ERROR));
                return;
            }

            const category = await categoryService.getCategoryById(validatedParams.id);
            res.status(StatusCodes.OK).json(category);
        } catch (error) {
            next(error);
        }
    }

    async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const validatedParams = req.validatedData?.params as { id: string };
            const validatedBody = req.validatedData?.body as UpdateCategoryInput;
            if (!validatedParams?.id || !validatedBody) {
                logger.error("Validated data missing in updateCategory");
                next(new ApiError("Internal processing error.", StatusCodes.INTERNAL_SERVER_ERROR));
                return;
            }

            const category = await categoryService.updateCategory(validatedParams.id, validatedBody);
            res.status(StatusCodes.OK).json(category);
        } catch (error) {
            next(error);
        }
    }

    async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const validatedParams = req.validatedData?.params as { id: string };
            if (!validatedParams?.id) {
                logger.error("Validated params missing in deleteCategory");
                next(new ApiError("Internal processing error.", StatusCodes.INTERNAL_SERVER_ERROR));
                return;
            }

            await categoryService.deleteCategory(validatedParams.id);
            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            next(error);
        }
    }
}

export default new CategoryController();
