import  Product  from "../model/Products.js";
import cloudinary from "../lib/cloudinary.js";

export const addProduct = async (req, res) =>{
    try {
        const {name, price, description, size, quantity, category} = req.body
        console.log(name, price, description, size, quantity, category)
        await Product.create({
            name,
            price,
            description,
            category,
            size: [{size:size, price: price, quantity: quantity}]
        })
        res.status(200).json({message:"Product added successfully"})
    } catch (error) {
        res.status(500).json({error: error.message})
    }
}