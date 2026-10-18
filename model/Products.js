    import mongoose from "mongoose";

export const PRODUCT_CATEGORIES = ["running", "basketball", "lifestyle", "training"];
const PRODUCT_CATEGORY_ENUM = [
    ...PRODUCT_CATEGORIES,
    "Running",
    "Basketball",
    "Lifestyle",
    "Training",
    "traning",
];

    const PerSizePriceSchema = new mongoose.Schema({
        size:{
            type:String,
            required:true
        },
        price:{
            type:Number,
            required:true
        },
        quantity:{
            type:Number,
            required:true
        }
    })
    const ProductSchema = new mongoose.Schema({
        name:{
            type:String,
            required:true
        },
        price:{
            type:Number,
            required:true
        },
        description:{
            type:String,
        },
        category:{
            type:[{ type:String, enum:PRODUCT_CATEGORY_ENUM }],
            required:true,
            validate:{
                validator:(categories) => Array.isArray(categories) && categories.length >= 1 && categories.length <= 2,
                message:"Choose one or two product categories."
            }
        },
        image:{
            type:String,
            required:true
        },
        size:[PerSizePriceSchema],
        buyCount:{
            type:Number,
            default:0
        }
    },{
        timestamps:true
    })

    const Product = mongoose.model("Product", ProductSchema)

    export default Product;
