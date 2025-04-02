import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import userRoutes from "./user.routes.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);

export default router;
