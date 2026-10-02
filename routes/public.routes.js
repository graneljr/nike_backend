import {getFeaturedProducts, getProducts, getProductById } from "../controller/Product.controller.js";

import express from "express";
const router = express.Router();

router.get("/", getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/:id", getProductById);

export default router;
