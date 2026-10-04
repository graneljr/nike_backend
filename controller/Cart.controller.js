import Cart from "../model/Cart.js";
import Product from "../model/Products.js";

function serializeCart(cart) {
  return {
    items: cart.items
      .filter((item) => item.productId)
      .map((item) => {
        const product = item.productId;
        const variant = product.size?.find((entry) => entry.size === item.size);
        return {
          ...product.toObject(),
          id: product._id.toString(),
          sizes: product.size.map((entry) => ({
            label: entry.size,
            quantity: entry.quantity,
          })),
          price: variant?.price ?? product.price,
          size: item.size,
          quantity: item.quantity,
          selected: item.selected,
        };
      }),
  };
}

export const getCart = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const cart = await Cart.findOne({ userId: req.session.userId }).populate(
      "items.productId",
    );
    return res.status(200).json(serializeCart(cart || { items: [] }));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load your cart." });
  }
};

export const saveCart = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const items = req.body.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Cart items must be an array." });
    }

    const savedCart = await Cart.findOne({ userId: req.session.userId });
    const normalizedItems = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (
        !item.productId ||
        !item.size ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({ message: "A cart item is invalid." });
      }

      const product = await Product.findById(item.productId).select("size");
      const variant = product?.size.find((entry) => entry.size === String(item.size));
      if (!variant) {
        return res.status(400).json({ message: "A selected product size is unavailable." });
      }
      const productId = product._id.toString();
      const savedItem = savedCart?.items.find(
        (entry) => entry.productId.toString() === productId && entry.size === String(item.size),
      );
      if (quantity > variant.quantity && quantity > (savedItem?.quantity || 0)) {
        return res.status(400).json({
          message: `Only ${variant.quantity} pair${variant.quantity === 1 ? "" : "s"} available for this size.`,
        });
      }

      normalizedItems.push({
        productId: product._id,
        size: String(item.size),
        quantity,
        selected: item.selected !== false,
      });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.session.userId },
      { $set: { items: normalizedItems } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).populate("items.productId");

    return res.status(200).json(serializeCart(cart));
  } catch (error) {
    return res.status(500).json({ message: "Unable to save your cart." });
  }
};
