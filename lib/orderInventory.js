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

const COMPLETED_ORDER_STATUSES = new Set(["delivered", "received"]);

async function rollbackBuyCount(changes) {
  for (const { productId, quantity } of [...changes].reverse()) {
    await Product.updateOne(
      { _id: productId },
      { $inc: { buyCount: -quantity } },
    );
  }
}

async function incrementBuyCount(items) {
  const quantitiesByProduct = new Map();
  for (const item of items) {
    const productId = String(item.productId?._id || item.productId);
    quantitiesByProduct.set(
      productId,
      (quantitiesByProduct.get(productId) || 0) + Number(item.quantity),
    );
  }

  const changed = [];
  try {
    for (const [productId, quantity] of quantitiesByProduct) {
      const result = await Product.updateOne(
        { _id: productId },
        { $inc: { buyCount: quantity } },
      );
      if (result.modifiedCount !== 1) {
        throw new InventoryError("Unable to update purchase count for a product in this order.");
      }
      changed.push({ productId, quantity });
    }
  } catch (error) {
    await rollbackBuyCount(changed);
    throw error;
  }

  return changed;
}

async function updateOrderStatusOnly(order, nextStatus) {
  const statusFields = { status: nextStatus };
  if (
    nextStatus === "cancelled" &&
    order.paymentStatus === "paid" &&
    !["pending", "refunded"].includes(order.refundStatus)
  ) {
    statusFields.refundStatus = "pending";
    statusFields.refundAmount = order.totalAmount;
    statusFields.refundRequestedAt = new Date();
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: order.status,
      inventoryAdjustmentInProgress: { $ne: true },
      buyCountAdjustmentInProgress: { $ne: true },
    },
    { $set: statusFields },
    { new: true, runValidators: true },
  );

  if (!updatedOrder) {
    throw new InventoryError("Order status is currently being updated. Try again shortly.");
  }
  return updatedOrder;
}

async function updateCompletedOrderStatus(order, nextStatus) {
  const wasAlreadyCompleted = COMPLETED_ORDER_STATUSES.has(order.status);
  if (wasAlreadyCompleted || order.buyCountAdjusted) {
    return updateOrderStatusOnly(order, nextStatus);
  }

  const claim = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: order.status,
      buyCountAdjusted: { $ne: true },
      buyCountAdjustmentInProgress: { $ne: true },
      inventoryAdjustmentInProgress: { $ne: true },
    },
    { $set: { buyCountAdjustmentInProgress: true } },
    { new: true },
  );

  if (!claim) {
    const latestOrder = await Order.findById(order._id);
    if (
      latestOrder &&
      (latestOrder.buyCountAdjusted || COMPLETED_ORDER_STATUSES.has(latestOrder.status))
    ) {
      if (latestOrder.status === nextStatus) return latestOrder;
      return updateOrderStatusOnly(latestOrder, nextStatus);
    }
    throw new InventoryError("Order is currently being updated. Try again shortly.");
  }

  let changedProducts = [];
  try {
    changedProducts = await incrementBuyCount(claim.items);
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        buyCountAdjustmentInProgress: true,
      },
      {
        $set: {
          status: nextStatus,
          buyCountAdjusted: true,
          buyCountAdjustmentInProgress: false,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedOrder) {
      throw new InventoryError("Order status changed while its products were being updated.");
    }
    return updatedOrder;
  } catch (error) {
    try {
      if (changedProducts.length > 0) await rollbackBuyCount(changedProducts);
    } finally {
      await Order.updateOne(
        { _id: order._id, buyCountAdjustmentInProgress: true },
        { $set: { buyCountAdjustmentInProgress: false } },
      );
    }
    throw error;
  }
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
            ...(claim.paymentStatus === "paid" &&
            !["pending", "refunded"].includes(claim.refundStatus)
              ? {
                  refundStatus: "pending",
                  refundAmount: claim.totalAmount,
                  refundRequestedAt: new Date(),
                }
              : {}),
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

  if (COMPLETED_ORDER_STATUSES.has(nextStatus)) {
    return updateCompletedOrderStatus(order, nextStatus);
  }

  return updateOrderStatusOnly(order, nextStatus);
}

export { InventoryError };
