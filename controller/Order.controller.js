import  Product  from "../model/Products.js";
import  User  from "../model/User.js";
import  Orders  from "../model/Orders.js";
export const metricsData = async (req, res) => {
    try{
        const orders = await Product.countDocuments({
            createdAt: {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
            }
        });
        const productsInStock = await Product.countDocuments({ quantity: { $gt: 0 } });
        const registeredUsers = await User.countDocuments();
        const salesThisMonth = await Orders.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                        $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" }
                }
            }
        ]);
        res.status(200).json({ orders, productsInStock, registeredUsers, salesThisMonth: salesThisMonth[0]?.totalSales || 0 });
    }catch(err){
        res.status(500).json({ error: err.message });
    }
}

export const monthlyOrders = async (req, res) => {
    try{
        const orders = await Orders.countDocuments({
            createdAt: {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
            }
        });
        res.status(200).json({ orders });
    }catch(err){
        res.status(500).json({ error: err.message });
    }
}

// TODO : Implement the latestOrders function to fetch the latest orders from the database and return them in the response.
export const latestOrders = async (req, res) => {
    try {
        
        const latestOrders = await Orders.find().sort({ createdAt: -1 }).limit(10).populate('items.productId', 'userId');
    } catch (error) {
        
    }
}

// TODO : Implement order function
// TODO : Implement updateOrderStatus function