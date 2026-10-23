import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    address: {
      type: String,
    },
    email: {
      type: String,
      unique:true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    contactNumber:{
        type:String,
           minlength: [11, 'Username must be at least 5 characters long'] 
    },
    role:{
      type:String,
      enum:["admin", "user"],
      default: "user"
    }
  },
  { timestamps: true },
);
const User  =  mongoose.model("User", UserSchema)
export default User;