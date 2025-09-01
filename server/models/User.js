import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, trim: true }, // email or phone
    name: { type: String, trim: true },

    // OTP block
    otpHash: { type: String },
    otpExpiresAt: { type: Date },
    otpTries: { type: Number, default: 0 },

    // optional: roles
    role: { type: String, enum: ["ADMIN", "STAFF", "USER"], default: "ADMIN" },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
