import express from "express";
import { addProduct } from "../controller/Product.controller.js";

const router = express.Router();

router.post("/add", addProduct);

export default router;