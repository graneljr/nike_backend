import Order from "../model/Orders.js";
import qr from "qrcode";
export const processPayment = async (req, res) => {
  try {
    const { orderId, paymentMethod, amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

   order.status = "processing";
   order.totalAmount = amount;
   await order.save();

   const paymentQRCode = await qr.toDataURL(`http://localhost:5173/pay${orderId}`);

    res.status(200).json({ message: "Payment process pending", paymentQRCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
