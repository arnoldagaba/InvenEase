import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { productService } from "@/api/services/product.service.ts";
import { GetProductQueryInput } from "@/api/validators/product.validator.ts";
import { BadRequestError } from "@/errors/index.ts";

export const productController = {
    /**
     * Handles request to create a new product.
     */
    async handleCreateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const productData = req.validatedData?.body;
            if (!productData) {
                next(new BadRequestError("Validated product data missing."));
                return;
            }
            const newProduct = await productService.createProduct(productData);
            res.status(StatusCodes.CREATED).json(newProduct);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to get all products.
     */
    async handleGetAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const queryParams: GetProductQueryInput | undefined = req.validatedData?.query;
            const result = await productService.getAllProducts(queryParams);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to get a single product by ID.
     */
    async handleGetProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params; // Already validated
            const product = await productService.getProductById(id);
            res.status(StatusCodes.OK).json(product);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to update a product by ID.
     */
    async handleUpdateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const productData = req.validatedData?.body;
            if (!productData) {
                next(new BadRequestError("Validated product update data missing."));
                return;
            }

            const updatedProduct = await productService.updateProduct(id, productData);
            res.status(StatusCodes.OK).json(updatedProduct);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handles request to delete a product by ID.
     */
    async handleDeleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            await productService.deleteProduct(id);
            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            next(error);
        }
    },
};
