import express from "express";
import { handleGetSystemStats } from "../controllers/stats.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, authorize("admin"), handleGetSystemStats);

export default router;
