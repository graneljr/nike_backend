import express from "express";
import { addProduct, addProductSize, getFeaturedProducts, getProducts, getProductById } from "../controller/Product.controller.js";
import multer from "multer";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Please upload an image file."));
      return;
    }
    callback(null, true);
  },
});

const handleImageUpload = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    next();
  });
};

router.get("/", getProducts)
router.post("/add", handleImageUpload, addProduct);
router.post("/:id/sizes", addProductSize);

export default router;
