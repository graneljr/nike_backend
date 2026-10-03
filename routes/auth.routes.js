import express, { Router } from "express";
import { GetMe, Login, Logout, Regisger, UpdateProfile } from "../controller/Auth.controller.js";

const router = express.Router();
router.post("/register",Regisger);
router.post("/login", Login)
router.get("/me",GetMe)
router.patch("/profile", UpdateProfile)
router.post("/logout", Logout)
export default router;
