import express from "express"
import { getUserMetrics, getUsers } from "../controller/User.controller.js"
import User from "../model/User.js"

const router = express.Router()

router.use(async (req, res, next) => {
    if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" })
    }

    try {
        const requestingUser = await User.findById(req.session.userId).select("role")
        if (requestingUser?.role !== "admin") {
            return res.status(403).json({ message: "Admin access required." })
        }
        return next()
    } catch (error) {
        return res.status(500).json({ message: "Unable to verify admin access." })
    }
})

router.get("/", getUsers)
router.get("/metrics", getUserMetrics)

export default router;
