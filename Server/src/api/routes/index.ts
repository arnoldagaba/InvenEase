import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import userRoutes from "./user.routes.ts";
import categoryRoutes from "./category.routes.ts";
import locationRoutes from "./location.routes.ts";
import productRoutes from "./product.routes.ts";
import stockRoutes from "./stock.routes.ts";
import transactionRoutes from "./transaction.routes.ts";
import supplierRoutes from "./supplier.routes.ts";
import purchaseOrderRoutes from "./purchaseOrder.routes.ts";
import salesOrderRoutes from "./salesOrder.routes.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/locations", locationRoutes);
router.use("/products", productRoutes);
router.use("/stock", stockRoutes);
router.use("/transactions", transactionRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/purchase-orders", purchaseOrderRoutes);
router.use("/sales-orders", salesOrderRoutes);

export default router;
