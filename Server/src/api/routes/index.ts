import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import userRoutes from "./user.routes.ts";
import categoryRoutes from "./category.routes.ts";
import locationRoutes from "./location.routes.ts";
import productRoutes from "./product.routes.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/locations", locationRoutes);
router.use("/products", productRoutes);

export default router;
