import  Product  from "../model/Products.js";
import cloudinary from "../lib/cloudinary.js";

export const addProduct = async (req, res) =>{
    try {
        const { name, description, category } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: "A product image is required." });
        }

        let sizes;
        try {
            sizes = JSON.parse(req.body.sizes || "[]");
        } catch {
            return res.status(400).json({ error: "Please provide valid size options." });
        }
        if (!Array.isArray(sizes) || sizes.length === 0 || !name?.trim() || !category?.trim()) {
            return res.status(400).json({ error: "Please provide valid product details." });
        }

        const parsedSizes = sizes.map(({ size, price, quantity }) => ({
            size: String(size || "").trim(),
            price: Number(price),
            quantity: Number(quantity),
        }));
        const hasInvalidSize = parsedSizes.some((entry) =>
            !entry.size || !Number.isFinite(entry.price) || entry.price < 0 ||
            !Number.isInteger(entry.quantity) || entry.quantity < 0
        );
        const uniqueSizes = new Set(parsedSizes.map((entry) => entry.size.toLowerCase()));
        if (hasInvalidSize || uniqueSizes.size !== parsedSizes.length) {
            return res.status(400).json({ error: "Each size must be unique and have a valid price and quantity." });
        }

        const imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const uploadResult = await cloudinary.uploader.upload(imageData, {
            folder: "sneaker-shop/products",
            resource_type: "image",
        });

        const product = await Product.create({
            name: name.trim(),
            price: parsedSizes[0].price,
            description,
            category: category.trim(),
            image: uploadResult.secure_url,
            size: parsedSizes,
        });
        res.status(201).json({ message: "Product added successfully", product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const addProductSize = async (req, res) => {
    try {
        const size = String(req.body.size || "").trim();
        const price = Number(req.body.price);
        const quantity = Number(req.body.quantity); 
        if (!size || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0) {
            return res.status(400).json({ error: "Please provide a valid size, price, and quantity." });
        }
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ error: "Product not found." });
        }
        if (product.size.some((entry) => entry.size.toLowerCase() === size.toLowerCase())) {
            return res.status(409).json({ error: "That size already exists for this product." });
        }

        product.size.push({ size, price, quantity });
        await product.save();
        res.status(200).json({ message: "Size added successfully", product });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(404).json({ error: "Product not found." });
        }
        res.status(500).json({ error: error.message });
    }
};


export const getProducts = async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


export const getFeaturedProducts = async (req, res) => {
    try{
        const featuredProducts = await Product.find({ buyCount: { $gte: 10 } }).limit(4);
        res.status(200).json(featuredProducts);
    } catch(err){
        res.status(500).json({ error: err.message });
    }
}

export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
         
        if (!product) {
            return res.status(404).json({ error: "Product not found." });
        }
       
        res.status(200).json(product);
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(404).json({ error: "Product not found." });
        }
        res.status(500).json({ error: error.message });
    }
};