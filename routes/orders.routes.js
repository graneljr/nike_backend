import express from "express";
import { metricsData, order, getOrderById,getLatestOrders,updateOrderStatus } from "../controller/Order.controller.js";

const router = express.Router();

router.get("/metrics_data", metricsData);
router.get("/latest_orders", getLatestOrders)
router.post("/", order);
router.get("/:orderId", getOrderById)
router.patch("/update_order",updateOrderStatus   )
export default router;
