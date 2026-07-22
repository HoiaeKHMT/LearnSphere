import mongoose from "mongoose";
import Lesson from "../models/Lesson.model.js";
import Course from "../models/Course.model.js";
import Enrollment from "../models/Enrollment.model.js";
import LessonProgress from "../models/LessonProgress.model.js";
import { deleteS3Objects, validateStoredFileKey } from "./file.service.js";

const verifyAccessPermission = async (course, userId, userRole) => {
	if (userRole === "admin") return;

	if (userRole === "tutor") {
		const isOwner = course.created_by.toString() === userId.toString();
		if (!isOwner) throw new Error("FORBIDDEN_LESSON_ACTION");
		return;
	}

	if (userRole === "student") {
		const enrollment = await Enrollment.findOne({
			user_id: userId,
			course_id: course._id,
			status: "active", 
		});
		if (!enrollment) throw new Error("ACTIVE_ENROLLMENT_REQUIRED");
		return;
	}

	throw new Error("FORBIDDEN_LESSON_ACTION");
};


export const createLesson = async (courseId, { title, content, video_key, document_key, order_index }, userId, userRole) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	const isOwner = course.created_by.toString() === userId.toString();
	if (userRole !== "tutor" || !isOwner) throw new Error("FORBIDDEN_LESSON_ACTION");

	if (typeof title !== "string" || !title.trim()) throw new Error("INVALID_LESSON_TITLE");
	if (content !== undefined && typeof content !== "string") throw new Error("INVALID_CONTENT");
	if (video_key !== undefined && typeof video_key !== "string") throw new Error("INVALID_VIDEO_KEY");
	if (document_key !== undefined && typeof document_key !== "string") throw new Error("INVALID_DOCUMENT_KEY");
	if (typeof order_index !== "number" || order_index < 1 || !Number.isInteger(order_index)) {
		throw new Error("INVALID_ORDER_INDEX");
	}

	const normalizedVideoKey = video_key?.trim() ?? "";
	const normalizedDocumentKey = document_key?.trim() ?? "";
	if (normalizedVideoKey) {
		await validateStoredFileKey({
			courseId,
			fileKey: normalizedVideoKey,
			folder: "lessons/videos",
			invalidKeyError: "INVALID_VIDEO_KEY",
		});
	}
	if (normalizedDocumentKey) {
		await validateStoredFileKey({
			courseId,
			fileKey: normalizedDocumentKey,
			folder: "lessons/documents",
			invalidKeyError: "INVALID_DOCUMENT_KEY",
		});
	}

	const newLesson = await Lesson.create({
        course_id: courseId,
		title: title.trim(),
		content: content ? content.trim() : "",
		video_key: normalizedVideoKey,
		document_key: normalizedDocumentKey,
		order_index: order_index,
	});
	return newLesson;
};


export const getCourseLessons = async (courseId, userId, userRole) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	await verifyAccessPermission(course, userId, userRole);

	return await Lesson.find({ course_id: courseId }).sort({ order_index: 1 });
};


export const getLessonById = async (lessonId, userId, userRole) => {
	if (!mongoose.isValidObjectId(lessonId)) throw new Error("INVALID_LESSON_ID");

	const lesson = await Lesson.findById(lessonId);
	if (!lesson) throw new Error("LESSON_NOT_FOUND");

	const course = await Course.findOne({ _id: lesson.course_id, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	await verifyAccessPermission(course, userId, userRole);

	return lesson;
};


export const updateLesson = async (lessonId, { title, content, video_key, document_key, order_index }, userId, userRole) => {
	if (!mongoose.isValidObjectId(lessonId)) throw new Error("INVALID_LESSON_ID");

	const lesson = await Lesson.findById(lessonId);
	if (!lesson) throw new Error("LESSON_NOT_FOUND");

	const course = await Course.findOne({ _id: lesson.course_id, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	const isOwner = course.created_by.toString() === userId.toString();
	if (userRole !== "tutor" || !isOwner) throw new Error("FORBIDDEN_LESSON_ACTION");

	if (title === undefined && content === undefined && video_key === undefined && document_key === undefined && order_index === undefined) {
		throw new Error("NO_FIELDS_TO_UPDATE");
	}

	if (title !== undefined && (typeof title !== "string" || !title.trim())) throw new Error("INVALID_LESSON_TITLE");
	if (content !== undefined && typeof content !== "string") throw new Error("INVALID_CONTENT");
	if (video_key !== undefined && typeof video_key !== "string") throw new Error("INVALID_VIDEO_KEY");
	if (document_key !== undefined && typeof document_key !== "string") throw new Error("INVALID_DOCUMENT_KEY");
	if (order_index !== undefined && (typeof order_index !== "number" || order_index < 1 || !Number.isInteger(order_index))) {
		throw new Error("INVALID_ORDER_INDEX");
	}

	let normalizedVideoKey;
	if (video_key !== undefined) {
		normalizedVideoKey = video_key.trim();
		if (normalizedVideoKey) {
			normalizedVideoKey = await validateStoredFileKey({
				courseId: course._id,
				fileKey: normalizedVideoKey,
				folder: "lessons/videos",
				invalidKeyError: "INVALID_VIDEO_KEY",
			});
		}
	}

	let normalizedDocumentKey;
	if (document_key !== undefined) {
		normalizedDocumentKey = document_key.trim();
		if (normalizedDocumentKey) {
			normalizedDocumentKey = await validateStoredFileKey({
				courseId: course._id,
				fileKey: normalizedDocumentKey,
				folder: "lessons/documents",
				invalidKeyError: "INVALID_DOCUMENT_KEY",
			});
		}
	}

	if (title) lesson.title = title.trim();
	if (content !== undefined) lesson.content = content.trim();
	if (video_key !== undefined && normalizedVideoKey !== lesson.video_key) {
		lesson.video_key = normalizedVideoKey;
	}
	if (document_key !== undefined && normalizedDocumentKey !== lesson.document_key) {
		lesson.document_key = normalizedDocumentKey;
		lesson.ai_document_text = "";
		lesson.ai_indexed_document_key = "";
		lesson.ai_index_status = "not_indexed";
		lesson.ai_indexed_at = null;
		lesson.ai_index_error = "";
		lesson.ai_summary = "";
		lesson.ai_summary_document_key = "";
		lesson.ai_summary_model_id = "";
		lesson.ai_summary_stop_reason = "";
		lesson.ai_summary_input_tokens = 0;
		lesson.ai_summary_output_tokens = 0;
		lesson.ai_summary_generated_at = null;
	}
	if (order_index) lesson.order_index = order_index;
	return await lesson.save();
};


export const deleteLesson = async (lessonId, userId, userRole) => {
	if (!mongoose.isValidObjectId(lessonId)) throw new Error("INVALID_LESSON_ID");

	const lesson = await Lesson.findById(lessonId);
	if (!lesson) throw new Error("LESSON_NOT_FOUND");

	const course = await Course.findOne({ _id: lesson.course_id, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	const isOwner = course.created_by.toString() === userId.toString();
	if (userRole !== "tutor" || !isOwner) throw new Error("FORBIDDEN_LESSON_ACTION");

	const s3Result = await deleteS3Objects([lesson.video_key, lesson.document_key]);
	lesson.video_key = "";
	lesson.document_key = "";
	await lesson.save();
	await LessonProgress.deleteMany({ lesson_id: lesson._id });
	await lesson.deleteOne();

	return { message: "Lesson and S3 files deleted successfully", deleted_s3_objects: s3Result.deleted_count };
};


export const completeLesson = async (lessonId, studentId) => {
	if (!mongoose.isValidObjectId(lessonId)) throw new Error("INVALID_LESSON_ID");

	const lesson = await Lesson.findById(lessonId);
	if (!lesson) throw new Error("LESSON_NOT_FOUND");

	const course = await Course.findOne({ _id: lesson.course_id, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	const enrollment = await Enrollment.findOne({ user_id: studentId, course_id: course._id, status: "active" });
	if (!enrollment) throw new Error("ACTIVE_ENROLLMENT_REQUIRED");

	const progress = await LessonProgress.findOneAndUpdate(
		{ user_id: studentId, lesson_id: lesson._id },
		{
			$set: {
				course_id: lesson.course_id,
				is_completed: true,
				completed_at: new Date(),
			},
		},
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	);
	return progress;
};


export const getCourseProgress = async (courseId, studentId) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	const enrollment = await Enrollment.findOne({ user_id: studentId, course_id: courseId, status: "active" });
	if (!enrollment) throw new Error("ACTIVE_ENROLLMENT_REQUIRED");

	const totalLessons = await Lesson.countDocuments({ course_id: courseId });
	if (totalLessons === 0) return { course_id: courseId, progress_percent: 0, completed_lessons: 0, total_lessons: 0 };

	const completedLessons = await LessonProgress.countDocuments({
		user_id: studentId,
		course_id: courseId,
		is_completed: true,
	});

	const progressPercent = Math.round((completedLessons / totalLessons) * 100);
	return {
		course_id: courseId,
		progress_percent: progressPercent,
		completed_lessons: completedLessons,
		total_lessons: totalLessons,
	};
};
