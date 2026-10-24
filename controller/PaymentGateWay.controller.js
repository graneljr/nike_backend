import { createHash, randomBytes } from "node:crypto";
import Order from "../model/Orders.js";
import qr from "qrcode";

const DEMO_PAYMENT_TTL_MS = 15 * 60 * 1000;

const validOrderId = (orderId) => /^[a-f\d]{24}$/i.test(orderId || "");
const validDemoToken = (token) => /^[a-f\d]{64}$/i.test(token || "");
const hashDemoToken = (token) =>
  createHash("sha256").update(token).digest("hex");

export const processPayment = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { orderId } = req.body;
    if (!validOrderId(orderId)) {
      return res.status(400).json({ message: "Invalid order reference." });
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: req.session.userId,
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    if (order.paymentMethod !== "online" || order.paymentStatus !== "pending") {
      return res.status(409).json({
        message: "This order is not waiting for an online payment.",
      });
    }

    const demoToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + DEMO_PAYMENT_TTL_MS);
    order.demoPaymentTokenHash = hashDemoToken(demoToken);
    order.demoPaymentTokenExpiresAt = expiresAt;
    await order.save();

    const paymentQrPayload = new URLSearchParams({
      orderId: order._id.toString(),
      demoToken,
    });
    const paymentQRCode = await qr.toDataURL(
      `solewallet://pay?${paymentQrPayload.toString()}`,
    );

    return res.status(200).json({
      amount: order.totalAmount,
      qrCode: paymentQRCode,
      expiresAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to prepare demo payment." });
  }
};

export const getDemoPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const token = req.query.token;
    if (!validOrderId(orderId) || !validDemoToken(token)) {
      return res.status(400).json({ message: "Invalid demo payment link." });
    }

    const order = await Order.findOne({
      _id: orderId,
      paymentMethod: "online",
      demoPaymentTokenHash: hashDemoToken(token),
    })
      .select("paymentStatus status totalAmount +demoPaymentTokenExpiresAt")
      .populate("userId", "fullName");

    if (!order) {
      return res.status(404).json({ message: "Demo payment link not found." });
    }
    if (
      !order.demoPaymentTokenExpiresAt ||
      order.demoPaymentTokenExpiresAt.getTime() <= Date.now()
    ) {
      return res.status(410).json({ message: "Demo payment link has expired." });
    }
    if (order.status === "cancelled") {
      return res.status(409).json({ message: "This order was cancelled." });
    }

    return res.status(200).json({
      orderId: order._id,
      amount: order.totalAmount,
      merchant: "Sneaker Shop",
      customerName: order.userId?.fullName || "Shopper",
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load demo payment." });
  }
};

export const completeDemoPayment = async (req, res) => {
  try {
    const { orderId, token } = req.body;
    if (!validOrderId(orderId) || !validDemoToken(token)) {
      return res.status(400).json({ message: "Invalid demo payment request." });
    }

    const tokenHash = hashDemoToken(token);
    const now = new Date();
    const order = await Order.findOne({
      _id: orderId,
      paymentMethod: "online",
      demoPaymentTokenHash: tokenHash,
    }).select("paymentStatus status +demoPaymentTokenExpiresAt");

    if (!order) {
      return res.status(404).json({ message: "Demo payment link not found." });
    }
    if (
      !order.demoPaymentTokenExpiresAt ||
      order.demoPaymentTokenExpiresAt <= now
    ) {
      return res.status(410).json({ message: "Demo payment link has expired." });
    }
    if (order.status === "cancelled") {
      return res.status(409).json({ message: "This order was cancelled." });
    }
    if (order.paymentStatus === "paid") {
      return res.status(200).json({
        message: "Demo payment already completed.",
        alreadyPaid: true,
      });
    }
    if (order.paymentStatus !== "pending") {
      return res.status(409).json({ message: "This order cannot be paid." });
    }

    const paidOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        paymentMethod: "online",
        paymentStatus: "pending",
        status: { $ne: "cancelled" },
        demoPaymentTokenHash: tokenHash,
        demoPaymentTokenExpiresAt: { $gt: now },
      },
      { $set: { paymentStatus: "paid", paidAt: now } },
      { new: true, runValidators: true },
    );

    if (!paidOrder) {
      const alreadyPaid = await Order.exists({
        _id: orderId,
        paymentStatus: "paid",
        demoPaymentTokenHash: tokenHash,
      });
      if (alreadyPaid) {
        return res.status(200).json({
          message: "Demo payment already completed.",
          alreadyPaid: true,
        });
      }
      return res.status(409).json({ message: "This order cannot be paid." });
    }

    req.io.to(`order_${orderId}`).emit("payment-success", {
      orderId,
      status: "paid",
    });
    req.io.emit("sales-metrics-updated", { orderId });
    return res.status(200).json({
      message: "Demo payment successful.",
      alreadyPaid: false,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to complete demo payment." });
  }
};

export const payOrder = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { orderId } = req.body;
    if (!validOrderId(orderId)) {
      return res.status(400).json({ message: "Invalid order reference." });
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: req.session.userId,
    }).select("paymentMethod paymentStatus status");
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    if (order.paymentMethod !== "online") {
      return res.status(409).json({ message: "This is not an online payment order." });
    }
    if (order.status === "cancelled") {
      return res.status(409).json({ message: "This order was cancelled." });
    }
    if (order.paymentStatus === "paid") {
      return res.status(200).json({ message: "Payment already completed." });
    }
    if (order.paymentStatus !== "pending") {
      return res.status(409).json({ message: "This order cannot be paid." });
    }

    const paidAt = new Date();
    const paidOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        userId: req.session.userId,
        paymentMethod: "online",
        paymentStatus: "pending",
        status: { $ne: "cancelled" },
      },
      { $set: { paymentStatus: "paid", paidAt } },
      { new: true, runValidators: true },
    );
    if (!paidOrder) {
      return res.status(409).json({ message: "This order cannot be paid." });
    }

    req.io.to(`order_${orderId}`).emit("payment-success", {
      orderId,
      status: "paid",
    });
    req.io.emit("sales-metrics-updated", { orderId });
    return res.status(200).json({ message: "Payment Successful" });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong!" });
  }
};
