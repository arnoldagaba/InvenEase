import { Router } from "express";
import { UserRole } from "@prisma/client";
import categoryController from "@/api/controllers/category.controller.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { createCategorySchema, updateCategorySchema, categoryIdSchema, listCategoriesSchema } from "@/api/validators/category.validator.ts";

const router = Router();

// --- Apply universal authentication middleware ---
router.use(authenticateToken);

// --- Define Category Routes ---

// POST /api/categories - Create a new category (Admin/Manager only)
router.post("/", authorizeRole([UserRole.ADMIN, UserRole.MANAGER]), validateRequest(createCategorySchema), categoryController.createCategory);

// GET /api/categories - List all categories (Any authenticated user)
router.get(
    "/",
    validateRequest(listCategoriesSchema), // Optional validation for query params
    categoryController.listCategories,
);

// GET /api/categories/:id - Get category by ID (Any authenticated user)
router.get("/:id", validateRequest(categoryIdSchema), categoryController.getCategoryById);

// PUT /api/categories/:id - Update category by ID (Admin/Manager only)
router.put("/:id", authorizeRole([UserRole.ADMIN, UserRole.MANAGER]), validateRequest(updateCategorySchema), categoryController.updateCategory);

// DELETE /api/categories/:id - Delete category by ID (Admin/Manager only)
router.delete("/:id", authorizeRole([UserRole.ADMIN, UserRole.MANAGER]), validateRequest(categoryIdSchema), categoryController.deleteCategory);

export default router;
