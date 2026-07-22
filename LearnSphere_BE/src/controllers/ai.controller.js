import {
	chatWithAI,
	deleteAIHistory,
	generateQuizWithAI,
	getAIHistory,
	summarizeLessonWithAI,
} from "../services/ai.service.js";

const clientErrors = new Map([
	["INVALID_AI_MESSAGE", [400, "Message is required and must not exceed 4000 characters"]],
	["INVALID_COURSE_ID", [400, "Invalid course ID format"]],
	["INVALID_LESSON_ID", [400, "Invalid lesson ID format"]],
	["INVALID_QUESTION_COUNT", [400, "number_of_questions must be an integer from 1 to 20"]],
	["INVALID_HISTORY_LIMIT", [400, "limit must be an integer from 1 to 100"]],
	["COURSE_NOT_FOUND", [404, "Course not found"]],
	["LESSON_NOT_FOUND", [404, "Lesson not found"]],
	["LESSON_COURSE_MISMATCH", [400, "Lesson does not belong to the specified course"]],
	["LESSON_DOCUMENT_REQUIRED", [409, "A document is required to summarize this lesson"]],
	["LESSON_CONTENT_EMPTY", [409, "Lesson has no text or indexed file content for AI processing"]],
	["AI_DOCUMENT_NOT_INDEXED", [422, "The attached document could not be read for AI processing"]],
	["AI_SUMMARY_NOT_READY", [409, "The teacher has not generated a summary for this document yet"]],
	["AI_INDEX_IN_PROGRESS", [409, "Lesson files are already being processed for AI"]],
	["AI_FILES_NOT_INDEXED", [409, "The teacher must process this lesson's files before students can use them with AI"]],
	["ACTIVE_ENROLLMENT_REQUIRED", [403, "Active enrollment in this course required"]],
	["FORBIDDEN_AI_ACTION", [403, "Forbidden - Access denied"]],
	["FORBIDDEN_LESSON_ACTION", [403, "Forbidden - Access denied"]],
	["AI_CONTEXT_TOO_LARGE", [413, "Lesson context is too large; split it into smaller lessons"]],
	["AI_INVALID_STRUCTURED_RESPONSE", [502, "AI returned an invalid quiz structure; please try again"]],
	["AI_EMPTY_RESPONSE", [502, "AI returned an empty response"]],
	["AI_TIMEOUT", [504, "AI request timed out; please try again"]],
	["AI_THROTTLED", [429, "AI provider quota exceeded; please try again later"]],
	["AI_ACCESS_DENIED", [503, "AI provider access is not authorized for this backend"]],
	["AI_CREDENTIALS_ERROR", [503, "AI provider credentials are missing or invalid"]],
	["AI_CONFIGURATION_ERROR", [503, "AI provider or model configuration is invalid"]],
	["AI_SERVICE_UNAVAILABLE", [503, "AI provider is temporarily unavailable"]],
]);

const sendAIError = (res, error, operation) => {
	const mapped = clientErrors.get(error.message);
	if (mapped) {
		if (error.message.startsWith("AI_")) {
			console.error(`${operation} provider error:`, {
				code: error.message,
				provider_status: error.cause?.status,
				provider_error: error.cause?.message,
				provider_cause: error.cause?.cause?.code || error.cause?.cause?.name,
			});
		}
		return res.status(mapped[0]).json({ message: mapped[1], code: error.message });
	}

	console.error(`${operation} error:`, error);
	return res.status(500).json({ message: "Internal server error" });
};

export const handleAIChat = async (req, res) => {
	try {
		const result = await chatWithAI({
			courseId: req.body?.course_id,
			lessonId: req.body?.lesson_id,
			message: req.body?.message,
			userId: req.user._id,
			userRole: req.user.role,
		});
		return res.status(200).json(result);
	} catch (error) {
		return sendAIError(res, error, "AI chat");
	}
};

export const handleSummarizeLesson = async (req, res) => {
	try {
		const result = await summarizeLessonWithAI({
			lessonId: req.params?.lesson_id,
			userId: req.user._id,
			userRole: req.user.role,
			forceRegenerate: req.body?.force_regenerate === true,
		});
		return res.status(200).json(result);
	} catch (error) {
		return sendAIError(res, error, "AI lesson summary");
	}
};

export const handleGenerateQuiz = async (req, res) => {
	try {
		const result = await generateQuizWithAI({
			lessonId: req.body?.lesson_id,
			numberOfQuestions: req.body?.number_of_questions,
			userId: req.user._id,
			userRole: req.user.role,
		});
		return res.status(200).json(result);
	} catch (error) {
		return sendAIError(res, error, "AI quiz generation");
	}
};

export const handleGetAIHistory = async (req, res) => {
	try {
		const items = await getAIHistory({
			courseId: req.query?.course_id,
			lessonId: req.query?.lesson_id,
			limit: req.query?.limit,
			userId: req.user._id,
			userRole: req.user.role,
		});
		return res.status(200).json({ items });
	} catch (error) {
		return sendAIError(res, error, "Get AI history");
	}
};

export const handleDeleteAIHistory = async (req, res) => {
	try {
		const result = await deleteAIHistory({
			courseId: req.query?.course_id,
			lessonId: req.query?.lesson_id,
			userId: req.user._id,
			userRole: req.user.role,
		});
		return res.status(200).json({ message: "AI history deleted", ...result });
	} catch (error) {
		return sendAIError(res, error, "Delete AI history");
	}
};
