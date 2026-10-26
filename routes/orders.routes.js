import express from "express";
import { metricsData, order, getOrderById, getLatestOrders, getMyOrders, getOrdersPaginated, updateMyOrderStatus, updateOrderStatus, getRefunds, approveRefund } from "../controller/Order.controller.js";

const router = express.Router();

router.get("/metrics_data", metricsData);
router.get("/latest_orders", getLatestOrders)
router.get("/all", getOrdersPaginated)
router.get("/my-orders", getMyOrders)
router.get("/refunds", getRefunds)
router.patch("/refunds/:orderId/approve", approveRefund)
router.patch("/my-orders/:orderId/status", updateMyOrderStatus)
router.post("/", order);
router.get("/:orderId", getOrderById)
router.patch("/update_order",updateOrderStatus   )
export default router;
