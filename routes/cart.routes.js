import express from "express";
import { getCart, saveCart } from "../controller/Cart.controller.js";

const router = express.Router();

router.get("/", getCart);
router.put("/", saveCart);

export default router;
