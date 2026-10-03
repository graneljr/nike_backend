import Product from "../model/Products.js";
import User from "../model/User.js";
import Orders from "../model/Orders.js";
import Order from "../model/Orders.js";
export const metricsData = async (req, res) => {
  try {
    const orders = await Orders.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
    });
    const productsInStock = await Product.countDocuments({
      quantity: { $gt: 0 },
    });
    const registeredUsers = await User.countDocuments();
    const salesThisMonth = await Orders.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            $lt: new Date(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              1,
            ),
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
        },
      },
    ]);
    res.status(200).json({
      orders,
      productsInStock,
      registeredUsers,
      salesThisMonth: salesThisMonth[0]?.totalSales || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const monthlyOrders = async (req, res) => {
  try {
    const orders = await Orders.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
    });
    res.status(200).json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLatestOrders = async (req, res) => {
  try {
    const latestOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "fullName email")
      .populate("items.productId");

    return res.status(200).json(latestOrders);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong!" });
  }
};

export const order = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }
    const { orderDetails, paymentMethod } = req.body;

    const orders = await Product.find({
      _id: { $in: orderDetails.map((detail) => detail.productId) },
    }).populate("size");

    let totalAmount = orders.reduce((total, order) => {
      const detail = orderDetails.find(
        (detail) => detail.productId === order._id.toString(),
      );

      if (!detail) return total;

      const sizeItem = order.size.find((item) => item.size === detail.size);

      if (!sizeItem) return total;

      return total + sizeItem.price * detail.quantity;
    }, 0);

    const orderId = await Orders.create({
      userId: req.session.userId,
      items: orderDetails.map((detail) => ({
        productId: detail.productId,
        quantity: detail.quantity,
        priceAtPurchase: orders
          .find((order) => order._id.toString() === detail.productId)
          .size.find((item) => item.size === detail.size).price,
        size: detail.size,
      })),
      totalAmount,
      paymentMethod,
    });

    res
      .status(201)
      .json({ message: "Order placed successfully", orderId: orderId._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Orders.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.status(200).json(order);
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};


export const updateOrderStatus = async (req, res) => {
  try {
    const {_id, status} = req.body
    const updateOrder = await Order.findByIdAndUpdate(_id, {status:status}, { new: true, runValidators: true })
    if(!updateOrder) return res.status(404).json({message:"Order is not found"})

    return res.status(200).json({message:"Order status updated"})
  } catch (error) {
    console.log(error)
    return res.status(500).json({message:"Something went wrong"})
  }
}