import {processPayment,payOrder} from "../controller/PaymentGateWay.controller.js";

import express from "express";

const router = express.Router();

router.post("/process_payment", processPayment);
router.patch("/pay", payOrder)
export default router;