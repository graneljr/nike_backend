import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectToMongoDB } from "./lib/dbConnection.js";
import Auth from "./routes/auth.routes.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import ordersRoutes from "./routes/orders.routes.js";
import productsRoutes from "./routes/products.routes.js";
import publicRoutes from "./routes/public.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import userRoutes from "./routes/users.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import http from "http";
import { Server } from "socket.io";
import paymentSocket from "./lib/paymentSocket.js";
dotenv.config();

const PORT = 3001;
const app = express();

app.use(
  cors({
    origin: true, // This dynamically reflects the incoming origin, bypassing the browser restriction
    credentials: true,
  })
);




const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(express.json());


paymentSocket(io);

app.use((req, res, next) => {
  req.io = io;
  next();
});



connectToMongoDB();

const SessionMIddleware = session({
  secret: process.env.SESSION_KEY,
  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),

  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24,
  },
});

app.use("/api/auth", SessionMIddleware, Auth);
app.use("/api/orders", SessionMIddleware, ordersRoutes);
app.use("/api/cart", SessionMIddleware, cartRoutes);
app.use("/api/products", SessionMIddleware, productsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payment", SessionMIddleware, paymentRoutes);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
