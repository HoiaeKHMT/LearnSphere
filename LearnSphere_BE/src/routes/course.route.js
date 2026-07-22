import express from "express";
import { handleCreateCourse, handleGetAllCourses, handleGetCourseById, handleUpdateCourse, handleDeleteCourse, handleGetDeletedCourses, handleRestoreCourse, handlePermanentlyDeleteCourse } from "../controllers/course.controller.js";
import { handleEnrollCourse, handleUnenrollCourse, handleGetCourseEnrollments, handleApproveEnrollment, handleRejectEnrollment } from "../controllers/enrollment.controller.js";
import { handleCreateLesson, handleGetCourseLessons, handleGetCourseProgress } from "../controllers/lesson.controller.js";
import { handleCreateQuiz, handleGetCourseQuizzes } from "../controllers/quiz.controller.js";
import { handleCreateCourseDiscussion, handleCreateCourseDiscussionReply, handleGetCourseDiscussions } from "../controllers/discussion.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", handleGetAllCourses);
router.get("/mine/deleted", protect, authorize("tutor", "admin"), handleGetDeletedCourses);
router.get("/:course_id", handleGetCourseById);

router.post("/", protect, authorize("tutor"), handleCreateCourse);
router.put("/:course_id", protect, authorize("tutor"), handleUpdateCourse);
router.delete("/:course_id", protect, authorize("tutor", "admin"), handleDeleteCourse);
router.patch("/:course_id/restore", protect, authorize("tutor", "admin"), handleRestoreCourse);
router.delete("/:course_id/permanent", protect, authorize("tutor", "admin"), handlePermanentlyDeleteCourse);

router.post("/:course_id/enroll", protect, authorize("student"), handleEnrollCourse);
router.delete("/:course_id/enroll", protect, authorize("student"), handleUnenrollCourse);

router.get("/:course_id/enrollments", protect, authorize("tutor", "admin"), handleGetCourseEnrollments);
router.patch("/:course_id/enrollments/:enrollment_id/approve", protect, authorize("tutor", "admin"), handleApproveEnrollment);
router.delete("/:course_id/enrollments/:enrollment_id", protect, authorize("tutor", "admin"), handleRejectEnrollment);

router.get("/:course_id/lessons", protect, handleGetCourseLessons);
router.post("/:course_id/lessons", protect, authorize("tutor"), handleCreateLesson);
router.get("/:course_id/progress", protect, authorize("student"), handleGetCourseProgress);

router.get("/:course_id/quizzes", protect, handleGetCourseQuizzes);
router.post("/:course_id/quizzes", protect, authorize("tutor"), handleCreateQuiz);

router.get("/:course_id/discussions", protect, handleGetCourseDiscussions);
router.post("/:course_id/discussions", protect, handleCreateCourseDiscussion);
router.post("/:course_id/discussions/:discussion_id/replies", protect, handleCreateCourseDiscussionReply);

export default router;
