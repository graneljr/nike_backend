import express from "express";
import { metricsData, order, getOrderById } from "../controller/Order.controller.js";

const router = express.Router();

router.get("/metrics_data", metricsData);
router.post("/", order);
router.get("/:orderId", getOrderById)
export default router;
