import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectToMongoDB } from "./lib/dbConnection.js"
import Auth from "./routes/auth.routes.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import ordersRoutes from "./routes/orders.routes.js";
import productsRoutes from "./routes/products.routes.js";
dotenv.config();
const PORT = 3001;
const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

connectToMongoDB();

app.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),

    cookie: {
      httpOnly: true,
      secure: false, // true when using HTTPS
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use("/api/auth", Auth);
app.use("/api/orders", ordersRoutes);
app.use("/api/products", productsRoutes);
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
