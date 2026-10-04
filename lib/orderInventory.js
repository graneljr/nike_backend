import Order from "../model/Orders.js";
import Product from "../model/Products.js";

class InventoryError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

async function changeInventory(items, direction) {
  const changed = [];

  for (const item of items) {
    const productId = item.productId?._id || item.productId;
    const size = String(item.size);
    const quantity = Number(item.quantity);
    const result = direction < 0
      ? await Product.updateOne(
          {
            _id: productId,
            size: { $elemMatch: { size, quantity: { $gte: quantity } } },
          },
          { $inc: { "size.$.quantity": -quantity } },
        )
      : await Product.updateOne(
          { _id: productId, "size.size": size },
          { $inc: { "size.$.quantity": quantity } },
        );

    if (result.modifiedCount !== 1) {
      for (const completed of changed.reverse()) {
        const completedProductId = completed.productId?._id || completed.productId;
        await Product.updateOne(
          {
            _id: completedProductId,
            size: {
              $elemMatch: {
                size: String(completed.size),
                ...(direction < 0 ? {} : { quantity: { $gte: completed.quantity } }),
              },
            },
          },
          { $inc: { "size.$.quantity": direction < 0 ? completed.quantity : -completed.quantity } },
        );
      }
      throw new InventoryError(
        direction < 0
          ? `Not enough stock is available for size ${size}.`
          : `Unable to restore stock for size ${size}.`,
      );
    }
    changed.push(item);
  }
}

async function releaseAdjustment(orderId) {
  await Order.updateOne(
    { _id: orderId, inventoryAdjustmentInProgress: true },
    { $set: { inventoryAdjustmentInProgress: false } },
  );
}

export async function updateOrderWithInventory(orderId, nextStatus) {
  const order = await Order.findById(orderId);
  if (!order) return null;
  if (order.status === nextStatus) return order;

  const shouldDeduct =
    order.status === "pending" &&
    ["processing", "shipped"].includes(nextStatus) &&
    !order.inventoryDeducted;

  if (shouldDeduct) {
    const claim = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: "pending",
        inventoryDeducted: { $ne: true },
        inventoryAdjustmentInProgress: { $ne: true },
      },
      { $set: { inventoryAdjustmentInProgress: true } },
      { new: true },
    );
    if (!claim) {
      const latest = await Order.findById(orderId);
      if (latest?.inventoryDeducted) {
        latest.status = nextStatus;
        await latest.save();
        return latest;
      }
      throw new InventoryError("Inventory is currently being updated. Try again shortly.");
    }

    try {
      await changeInventory(claim.items, -1);
      return await Order.findOneAndUpdate(
        { _id: orderId, inventoryAdjustmentInProgress: true },
        {
          $set: {
            status: nextStatus,
            inventoryDeducted: true,
            inventoryAdjustmentInProgress: false,
          },
        },
        { new: true, runValidators: true },
      );
    } catch (error) {
      await releaseAdjustment(orderId);
      throw error;
    }
  }

  if (nextStatus === "cancelled" && order.inventoryDeducted && !order.inventoryRestored) {
    const claim = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: order.status,
        inventoryDeducted: true,
        inventoryRestored: { $ne: true },
        inventoryAdjustmentInProgress: { $ne: true },
      },
      { $set: { inventoryAdjustmentInProgress: true } },
      { new: true },
    );
    if (!claim) {
      const latest = await Order.findById(orderId);
      if (latest?.inventoryRestored) {
        latest.status = "cancelled";
        await latest.save();
        return latest;
      }
      throw new InventoryError("Inventory is currently being updated. Try again shortly.");
    }

    try {
      await changeInventory(claim.items, 1);
      return await Order.findOneAndUpdate(
        { _id: orderId, inventoryAdjustmentInProgress: true },
        {
          $set: {
            status: "cancelled",
            inventoryRestored: true,
            inventoryAdjustmentInProgress: false,
          },
        },
        { new: true, runValidators: true },
      );
    } catch (error) {
      await releaseAdjustment(orderId);
      throw error;
    }
  }

  order.status = nextStatus;
  await order.save();
  return order;
}

export { InventoryError };
