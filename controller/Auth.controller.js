import User from "../model/User.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const Regisger = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const hashedPassword = await hashPassword(password);
    await User.create({
      fullName: fullName,
      email: email,
      password: hashedPassword,
    });
    return res.status(201).json({ message: "Register successful" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Something went wrong!" });
  }
};

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userProfile = await User.findOne({ email });
    console.log(userProfile);
    if (!userProfile)
      return res.status(404).json({ message: "Email is not registred" });
    const isPasswordMatched = await comparePassword(
      password,
      userProfile.password,
    );

    if (!isPasswordMatched)
      return res.status(401).json({ message: "Passowrd is not matched" });
    req.session.userId = userProfile._id;

    return res.status(200).json({
      userData: {
        fullName: userProfile.fullName, 
        email: userProfile.email,
        contactNumber: userProfile.contactNumber || null,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: "Something went wrong!" });
  }
};


export const Logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        message: "Logout failed",
      });
    }

    res.clearCookie("connect.sid");

    return res.status(200).json({
      message: "Logout successful",
    });
  });
};

export const GetMe = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const user = await User.findById(req.session.userId).select(
      "-password"
    );

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      userData: user,
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};