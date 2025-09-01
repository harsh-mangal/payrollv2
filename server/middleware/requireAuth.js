import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-jwt");
    const user = await User.findById(payload.uid).select("_id identifier name role");
    if (!user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    req.user = { id: String(user._id), identifier: user.identifier, name: user.name, role: user.role };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
}
