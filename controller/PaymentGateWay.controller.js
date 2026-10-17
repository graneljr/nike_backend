import Order from "../model/Orders.js";
import Product from "../model/Products.js";
import qr from "qrcode";
export const processPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const amount = order.totalAmount;
    const paymentQRCode = await qr.toDataURL(
      `http://10.10.181.178:5173/pay/${orderId}`,
    );
    res.status(200).json({ amount: amount, qrCode: paymentQRCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const payOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findByIdAndUpdate(
      orderId,
      { paymentStatus: "paid" },
      { new: true, runValidators: true },
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
     req.io
      .to(`order_${orderId}`)
      .emit("payment-success", {
        orderId,
        status: "paid",
      });

    return res.status(200).json({ message: "Payment Successful" });
  } catch (error) {
    console.log();
    return res.status(500).json({ message: "Something went wrong!" });
  }
};
