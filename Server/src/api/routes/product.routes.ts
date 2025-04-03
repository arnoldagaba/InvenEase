import { Router } from "express";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { UserRole } from "@prisma/client";

// Import validators and controller
import { createProductSchema, updateProductSchema, productIdParamSchema, getProductQuerySchema } from "@/api/validators/product.validator.ts";
import { productController } from "@/api/controllers/product.controller.ts";

const router = Router();

// --- Product Routes ---

// POST /api/products - Create a new product (Admin/Manager)
router.post(
    "/",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(createProductSchema),
    productController.handleCreateProduct,
);

// GET /api/products - Get all products (All authenticated users)
router.get("/", authenticateToken, validateRequest(getProductQuerySchema), productController.handleGetAllProducts);

// GET /api/products/:id - Get a single product by ID (All authenticated users)
router.get("/:id", authenticateToken, validateRequest(productIdParamSchema), productController.handleGetProductById);

// PUT /api/products/:id - Update a product by ID (Admin/Manager)
router.put(
    "/:id",
    authenticateToken,
    authorizeRole([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest(updateProductSchema),
    productController.handleUpdateProduct,
);

// DELETE /api/products/:id - Delete a product by ID (Admin only)
router.delete(
    "/:id",
    authenticateToken,
    authorizeRole([UserRole.ADMIN]),
    validateRequest(productIdParamSchema),
    productController.handleDeleteProduct,
);

export default router;
