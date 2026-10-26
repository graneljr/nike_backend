import User from "../model/User.js";
import Order from "../model/Orders.js";


export const getUsers = async (req, res) => {
    try {
        const users  = await User.find({role:"user"}).select("-password").lean()
        return res.status(200).json(users)
    } catch (error) {
        return res.status(500).json({message:"Something went wrong!"})
    }
}

export const getUserMetrics = async (_req, res) => {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const customerFilter = { role: "user" };
        const percentageChange = (current, previous) =>
            previous === 0 ? (current === 0 ? 0 : "new") : ((current - previous) / previous) * 100;

        const [
            totalCustomers,
            customersBeforeThisMonth,
            newCustomersThisMonth,
            newCustomersLastMonth,
            ordersPlaced,
            ordersBeforeThisMonth,
        ] = await Promise.all([
            User.countDocuments(customerFilter),
            User.countDocuments({
                ...customerFilter,
                createdAt: { $lt: monthStart },
            }),
            User.countDocuments({
                ...customerFilter,
                createdAt: { $gte: monthStart, $lt: nextMonthStart },
            }),
            User.countDocuments({
                ...customerFilter,
                createdAt: { $gte: previousMonthStart, $lt: monthStart },
            }),
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $lt: monthStart } }),
        ]);

        return res.status(200).json({
            totalCustomers,
            newCustomersThisMonth,
            ordersPlaced,
            trends: {
                totalCustomers: percentageChange(totalCustomers, customersBeforeThisMonth),
                newCustomersThisMonth: percentageChange(newCustomersThisMonth, newCustomersLastMonth),
                ordersPlaced: percentageChange(ordersPlaced, ordersBeforeThisMonth),
            },
        });
    } catch (error) {
        return res.status(500).json({ message: "Unable to load customer metrics." });
    }
};
