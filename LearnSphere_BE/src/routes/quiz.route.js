import express from "express";
import { handleUpdateQuiz, handleDeleteQuiz, handleAddQuestion, handleGetQuizQuestions, handleUpdateQuestion, handleDeleteQuestion, handleStartQuiz, handleGetQuizAttempts } from "../controllers/quiz.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.put("/:quiz_id", protect, authorize("tutor"), handleUpdateQuiz);
router.delete("/:quiz_id", protect, authorize("tutor"), handleDeleteQuiz);

router.get("/:quiz_id/questions", protect, authorize("tutor", "admin"), handleGetQuizQuestions);
router.post("/:quiz_id/questions", protect, authorize("tutor"), handleAddQuestion);
router.put("/:quiz_id/questions/:question_id", protect, authorize("tutor"), handleUpdateQuestion);
router.delete("/:quiz_id/questions/:question_id", protect, authorize("tutor"), handleDeleteQuestion);

router.post("/:quiz_id/start", protect, authorize("student"), handleStartQuiz); 
router.get("/:quiz_id/attempts", protect, handleGetQuizAttempts);

export default router;
