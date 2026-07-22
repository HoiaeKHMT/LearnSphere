import express from "express";
import { handleGetMyCourses } from "../controllers/enrollment.controller.js";
import { handleGetUsers, handleUpdateOwnProfile, handleUpdateTutorAccountStatus } from "../controllers/user.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me/courses", protect, authorize("student"), handleGetMyCourses);
router.patch("/me", protect, handleUpdateOwnProfile);
router.get("/", protect, authorize("admin"), handleGetUsers);
router.patch("/:user_id/status", protect, authorize("admin"), handleUpdateTutorAccountStatus);

export default router;
