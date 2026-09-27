import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectToMongoDB } from "./dbConnection.js";
import Auth from "./routes/auth.routes.js";
import session from "express-session";
import MongoStore from "connect-mongo";

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
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
