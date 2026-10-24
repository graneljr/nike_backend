import {
  completeDemoPayment,
  getDemoPayment,
  payOrder,
  processPayment,
} from "../controller/PaymentGateWay.controller.js";

import express from "express";

const router = express.Router();

router.post("/process_payment", processPayment);
router.get("/demo/:orderId", getDemoPayment);
router.post("/demo/pay", completeDemoPayment);
router.patch("/pay", payOrder);
export default router;
