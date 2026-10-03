import Product from "../model/Products.js";
import User from "../model/User.js";
import Orders from "../model/Orders.js";
import Order from "../model/Orders.js";
export const metricsData = async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const monthRange = (start, end) => ({
      createdAt: { $gte: start, $lt: end },
    });
    const paidSales = (start, end) =>
      Orders.aggregate([
        { $match: { paymentStatus: "paid", ...monthRange(start, end) } },
        { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
      ]);
    const percentageChange = (current, previous) =>
      previous === 0
        ? current === 0
          ? 0
          : "new"
        : ((current - previous) / previous) * 100;

    const [
      orders,
      ordersPreviousMonth,
      productsInStock,
      registeredUsers,
      usersBeforeThisMonth,
      salesThisMonth,
      salesPreviousMonth,
    ] = await Promise.all([
      Orders.countDocuments(monthRange(monthStart, nextMonthStart)),
      Orders.countDocuments(monthRange(previousMonthStart, monthStart)),
      Product.countDocuments({ "size.quantity": { $gt: 0 } }),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $lt: monthStart } }),
      paidSales(monthStart, nextMonthStart),
      paidSales(previousMonthStart, monthStart),
    ]);
    const currentSales = salesThisMonth[0]?.totalSales || 0;
    const previousSales = salesPreviousMonth[0]?.totalSales || 0;
    res.status(200).json({
      orders,
      productsInStock,
      registeredUsers,
      salesThisMonth: currentSales,
      trends: {
        orders: percentageChange(orders, ordersPreviousMonth),
        registeredUsers: percentageChange(
          registeredUsers,
          usersBeforeThisMonth,
        ),
        salesThisMonth: percentageChange(currentSales, previousSales),
      },
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

export const getOrdersPaginated = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const requestingUser = await User.findById(req.session.userId).select(
      "role",
    );
    if (requestingUser?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const allowedStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "received",
      "cancelled",
    ];
    const status = req.query.status?.toLowerCase();
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid order status filter." });
    }
    const filter = status ? { status } : {};

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "fullName email")
        .populate("items.productId", "name image"),
      Order.countDocuments(filter),
    ]);

    const normalizedOrders = orders.map((order) => ({
      ...order.toObject(),
      fullName: order.userId?.fullName || "Unknown customer",
    }));
    return res.status(200).json({
      orders: normalizedOrders,
      page,
      limit,
      totalOrders,
      totalPages: Math.max(1, Math.ceil(totalOrders / limit)),
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load orders." });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const userFilter = { userId: req.session.userId };
    const percentageChange = (current, previous) =>
      previous === 0
        ? current === 0
          ? 0
          : "new"
        : ((current - previous) / previous) * 100;

    const orderQuery = Order.find(userFilter)
      .sort({ createdAt: -1 })
      .populate("items.productId", "name image");
    if (req.query.all !== "true") orderQuery.limit(5);

    const [
      orders,
      totalOrders,
      onTheWay,
      ordersThisMonth,
      ordersPreviousMonth,
      ordersBeforeThisMonth,
    ] = await Promise.all([
      orderQuery,
      Order.countDocuments(userFilter),
      Order.countDocuments({ ...userFilter, status: "shipped" }),
      Order.countDocuments({
        ...userFilter,
        createdAt: { $gte: monthStart, $lt: nextMonthStart },
      }),
      Order.countDocuments({
        ...userFilter,
        createdAt: { $gte: previousMonthStart, $lt: monthStart },
      }),
      Order.countDocuments({ ...userFilter, createdAt: { $lt: monthStart } }),
    ]);

    return res.status(200).json({
      orders,
      totalOrders,
      onTheWay,
      ordersThisMonth,
      trends: {
        totalOrders: percentageChange(totalOrders, ordersBeforeThisMonth),
        ordersThisMonth: percentageChange(ordersThisMonth, ordersPreviousMonth),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load your orders." });
  }
};

export const updateMyOrderStatus = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.session.userId,
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const nextStatus = req.body.status;
    const canCancel =
      order.status === "processing" && nextStatus === "cancelled";
    const canConfirmReceived =
      order.status === "shipped" && nextStatus === "received";
    if (!canCancel && !canConfirmReceived) {
      return res.status(400).json({
        message:
          "You can cancel processing orders or confirm receipt of shipped orders.",
      });
    }
    if(order.paymentMethod === "cod" && nextStatus === "received") {
      order.paymentStatus = "paid"
    }
    order.status = nextStatus;
    await order.save();
    return res.status(200).json({
      message:
        nextStatus === "received"
          ? "Order marked as received."
          : "Order cancelled.",
      order,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({ message: "Order not found." });
    }
    return res.status(500).json({ message: "Unable to update this order." });
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
    const { _id, status } = req.body;
    const updateOrder = await Order.findByIdAndUpdate(
      _id,
      { status: status },
      { new: true, runValidators: true },
    );
    if (!updateOrder) return res.status(404).json({ message: "Order is not found" });
    if (updateOrder.paymentMethod === "cod" && (status === "received" || status === "delivered")) {
       console.log(status)
      await Order.findByIdAndUpdate(_id, { paymentStatus: "paid" } );
      console.log("cod success")
    }
    return res.status(200).json({ message: "Order status updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
