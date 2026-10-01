import express from "express";
import { metricsData } from "../controller/Order.controller.js";

const router = express.Router();

router.get("/metrics_data", metricsData);

export default router;
