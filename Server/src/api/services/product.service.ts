import prisma from "@/config/prisma.ts";
import { Prisma, Product } from "@prisma/client";
import { NotFoundError, ConflictError } from "@/errors/index.ts";
import { CreateProductInput, UpdateProductInput, GetProductQueryInput } from "@/api/validators/product.validator.ts";

export const productService = {
    /**
     * Creates a new product, ensuring SKU uniqueness and optional category validation.
     * @param data - Product creation data.
     * @returns The newly created product.
     * @throws ConflictError if SKU already exists.
     * @throws NotFoundError if provided categoryId does not exist.
     */
    async createProduct(data: CreateProductInput): Promise<Product> {
        // 1. Check SKU uniqueness (case-insensitive often preferred for SKUs)
        const existingSku = await prisma.product.findUnique({
            where: { sku: data.sku }, // Prisma unique handles DB collation settings
        });
        if (existingSku) {
            throw new ConflictError(`Product with SKU "${data.sku}" already exists.`);
        }

        // 2. Optional: Validate categoryId if provided
        if (data.categoryId) {
            const categoryExists = await prisma.category.findUnique({
                where: { id: data.categoryId },
            });
            if (!categoryExists) {
                throw new NotFoundError(`Category with ID "${data.categoryId}" not found.`);
            }
        }

        // 3. Create the product
        const newProduct = await prisma.product.create({
            data: {
                ...data,
                // Explicitly map validated fields (helps prevent accidental leakage)
                sku: data.sku,
                name: data.name,
                description: data.description,
                categoryId: data.categoryId,
                unit: data.unit,
                reorderLevel: data.reorderLevel,
                costPrice: data.costPrice,
                sellingPrice: data.sellingPrice,
                imageUrl: data.imageUrl,
            },
            include: { category: true }, // Include category details in the response
        });
        return newProduct;
    },

    /**
     * Retrieves products with filtering, sorting, and pagination.
     * @param queryParams - Parameters for filtering, sorting, pagination.
     * @returns Paginated list of products.
     */
    async getAllProducts(queryParams?: GetProductQueryInput) {
        const page = Math.max(1, queryParams?.page || 1);
        const limit = queryParams?.limit || 1;
        const search = queryParams?.search?.trim();
        const categoryId = queryParams?.categoryId;
        const sortBy = queryParams?.sortBy || "name";
        const sortOrder = queryParams?.sortOrder || "asc";
        const skip = (page - 1) * limit;

        const where: Prisma.ProductWhereInput = {};
        if (search) {
            where.OR = [{ name: { contains: search } }, { sku: { contains: search } }, { description: { contains: search } }];
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }

        const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortOrder };

        const [products, totalCount] = await prisma.$transaction([
            prisma.product.findMany({
                where,
                include: { category: { select: { id: true, name: true } } }, // Include category name
                skip: skip,
                take: limit,
                orderBy: orderBy,
            }),
            prisma.product.count({ where }),
        ]);

        return {
            data: products,
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
        };
    },

    /**
     * Retrieves a single product by its ID.
     * @param id - Product UUID.
     * @returns The product object with category details.
     * @throws NotFoundError if not found.
     */
    async getProductById(id: string): Promise<Product> {
        const product = await prisma.product.findUnique({
            where: { id },
            include: { category: true }, // Include full category details
        });

        if (!product) {
            throw new NotFoundError(`Product with ID "${id}" not found.`);
        }
        return product;
    },

    /**
     * Retrieves a single product by its SKU.
     * @param sku - Product SKU.
     * @returns The product object with category details.
     * @throws NotFoundError if not found.
     */
    async getProductBySku(sku: string): Promise<Product> {
        const product = await prisma.product.findUnique({
            where: { sku },
            include: { category: true },
        });

        if (!product) {
            throw new NotFoundError(`Product with SKU "${sku}" not found.`);
        }
        return product;
    },

    /**
     * Updates an existing product. Handles SKU uniqueness and category validation.
     * @param id - Product UUID.
     * @param data - Data to update.
     * @returns The updated product.
     * @throws NotFoundError if product or new categoryId not found.
     * @throws ConflictError if updating to an existing SKU (of another product).
     */
    async updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
        // 1. Find the existing product
        const existingProduct = await prisma.product.findUnique({ where: { id } });
        if (!existingProduct) {
            throw new NotFoundError(`Product with ID "${id}" not found.`);
        }

        // 2. Check SKU conflict if SKU is being changed
        if (data.sku && data.sku !== existingProduct.sku) {
            const conflictingSku = await prisma.product.findUnique({
                where: { sku: data.sku },
            });
            if (conflictingSku && conflictingSku.id !== id) {
                throw new ConflictError(`Another product with SKU "${data.sku}" already exists.`);
            }
        }

        // 3. Validate categoryId if it's being changed (to a non-null value)
        if (data.categoryId && data.categoryId !== existingProduct.categoryId) {
            const categoryExists = await prisma.category.findUnique({
                where: { id: data.categoryId },
            });
            if (!categoryExists) {
                throw new NotFoundError(`Category with ID "${data.categoryId}" not found.`);
            }
        }

        // 4. Perform the update
        // Prisma handles `undefined` fields by ignoring them.
        // `null` is treated as an explicit value to set.
        const updatedProduct = await prisma.product.update({
            where: { id },
            data: data, // Pass validated partial data directly
            include: { category: true },
        });

        return updatedProduct;
    },

    /**
     * Deletes a product by ID after checking dependencies.
     * @param id - Product UUID.
     * @returns The deleted product object.
     * @throws NotFoundError if product not found.
     * @throws ConflictError if product has existing stock levels, transactions, or is on orders.
     */
    async deleteProduct(id: string): Promise<Product> {
        // **CRITICAL: Check for dependencies before deleting**
        const [stockCount, transactionCount, poItemCount, soItemCount] = await prisma.$transaction([
            prisma.stockLevel.count({ where: { productId: id } }),
            prisma.transaction.count({ where: { productId: id } }),
            prisma.purchaseOrderItem.count({ where: { productId: id } }),
            prisma.salesOrderItem.count({ where: { productId: id } }),
        ]);

        if (stockCount > 0) {
            throw new ConflictError(`Cannot delete product ID "${id}". Stock levels exist.`);
        }
        if (transactionCount > 0) {
            throw new ConflictError(`Cannot delete product ID "${id}". Transaction history exists.`);
        }
        if (poItemCount > 0) {
            throw new ConflictError(`Cannot delete product ID "${id}". It exists on purchase orders.`);
        }
        if (soItemCount > 0) {
            throw new ConflictError(`Cannot delete product ID "${id}". It exists on sales orders.`);
        }
        // Consider adding more checks if needed based on your exact relations/logic

        try {
            const deletedProduct = await prisma.product.delete({
                where: { id },
            });
            return deletedProduct;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                throw new NotFoundError(`Product with ID "${id}" not found.`);
            }
            // Rethrow unexpected errors
            throw error;
        }
    },
};
