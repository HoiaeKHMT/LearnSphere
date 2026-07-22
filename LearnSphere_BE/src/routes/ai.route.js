import express from "express";
import {
	handleAIChat,
	handleDeleteAIHistory,
	handleGenerateQuiz,
	handleGetAIHistory,
	handleSummarizeLesson,
} from "../controllers/ai.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";
import { aiRateLimit } from "../middleware/ai-rate-limit.middleware.js";

const router = express.Router();

router.get("/history", protect, handleGetAIHistory);
router.delete("/history", protect, handleDeleteAIHistory);
router.post("/chat", protect, aiRateLimit, handleAIChat);
router.post("/summarize-lesson/:lesson_id", protect, aiRateLimit, handleSummarizeLesson);
router.post(
	"/generate-quiz",
	protect,
	authorize("tutor"),
	aiRateLimit,
	handleGenerateQuiz,
);

export default router;
