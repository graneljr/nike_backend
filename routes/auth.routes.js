import express, { Router } from "express";
import { GetMe, Login, Logout, Regisger } from "../controller/Auth.controller.js";

const router = express.Router();
router.post("/register",Regisger);
router.post("/login", Login)
router.get("/me",GetMe)
router.post("/logout", Logout)
export default router;
