import express from "express"
import { getUserMetrics, getUsers } from "../controller/User.controller.js"

const router = express.Router()


router.get("/", getUsers)
router.get("/metrics", getUserMetrics)

export default router;
