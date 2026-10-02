    import mongoose from "mongoose";


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
            type:String,
            required:true
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
