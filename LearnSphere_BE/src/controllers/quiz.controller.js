import { createQuiz, getCourseQuizzes, updateQuiz, deleteQuiz, addQuestion, getQuizQuestions, updateQuestion, deleteQuestion, startQuiz, submitQuiz, getQuizAttempts, getAttemptById } from "../services/quiz.service.js";

export const handleCreateQuiz = async (req, res) => {
	const { course_id } = req.params ?? {};
	const { title, description, time_limit, difficulty } = req.body ?? {};
	try {
		const quiz = await createQuiz(course_id, { title, description, time_limit, difficulty }, req.user._id, req.user.role);
		return res.status(201).json({ message: "Quiz created successfully", quiz });
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Access denied" });
		if (error.message === "INVALID_QUIZ_TITLE") return res.status(400).json({ message: "Valid quiz title is required and must be a string" });
		if (error.message === "INVALID_DESCRIPTION") return res.status(400).json({ message: "Description must be a string" });
		if (error.message === "INVALID_TIME_LIMIT") return res.status(400).json({ message: "Time limit must be an integer number greater than 0" });
		if (error.message === "INVALID_DIFFICULTY") return res.status(400).json({ message: "Difficulty must be basic, medium, or advanced" });

		console.error("Create quiz error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetCourseQuizzes = async (req, res) => {
	const { course_id } = req.params ?? {};
	try {
		const quizzes = await getCourseQuizzes(course_id, req.user._id, req.user.role);
		return res.status(200).json(quizzes);
	} catch (error) {
		if (error.message === "INVALID_COURSE_ID") return res.status(400).json({ message: "Invalid course ID format" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment in this course required" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Access denied" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleUpdateQuiz = async (req, res) => {
	const { quiz_id } = req.params ?? {};
	const { title, description, time_limit, difficulty } = req.body ?? {};
	try {
		const updated = await updateQuiz(quiz_id, { title, description, time_limit, difficulty }, req.user._id, req.user.role);
		return res.status(200).json({ message: "Quiz updated successfully", quiz: updated });
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID") return res.status(400).json({ message: "Invalid quiz ID format" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Action denied" });
		if (error.message === "QUIZ_HAS_ACTIVE_ATTEMPTS") return res.status(409).json({ message: "Quiz cannot be modified while students are taking it" });
		if (error.message === "NO_FIELDS_TO_UPDATE") return res.status(400).json({ message: "At least one quiz field is required to update" });
		if (error.message === "INVALID_QUIZ_TITLE") return res.status(400).json({ message: "Invalid quiz title format" });
		if (error.message === "INVALID_DESCRIPTION") return res.status(400).json({ message: "Description must be a string" });
		if (error.message === "INVALID_TIME_LIMIT") return res.status(400).json({ message: "Time limit must be an integer number greater than 0" });
		if (error.message === "INVALID_DIFFICULTY") return res.status(400).json({ message: "Difficulty must be basic, medium, or advanced" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleDeleteQuiz = async (req, res) => {
	const { quiz_id } = req.params ?? {};
	try {
		const result = await deleteQuiz(quiz_id, req.user._id, req.user.role);
		return res.status(200).json(result);
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID") return res.status(400).json({ message: "Invalid quiz ID format" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Action denied" });
		if (error.message === "QUIZ_HAS_ACTIVE_ATTEMPTS") return res.status(409).json({ message: "Quiz cannot be modified while students are taking it" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleAddQuestion = async (req, res) => {
	const { quiz_id } = req.params ?? {};
	try {
		const question = await addQuestion(quiz_id, req.body, req.user._id, req.user.role);
		return res.status(201).json({ message: "Question added successfully", question });
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID") return res.status(400).json({ message: "Invalid quiz ID format" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Access denied" });
		if (error.message === "QUIZ_HAS_ACTIVE_ATTEMPTS") return res.status(409).json({ message: "Quiz cannot be modified while students are taking it" });
		if (["INVALID_QUESTION_CONTENT", "INVALID_QUESTION_TYPE", "INVALID_POINT", "INVALID_ANSWERS"].includes(error.message)) {
			return res.status(400).json({ message: "Invalid question fields or less than 2 answers provided" });
		}
		if (error.message === "DUPLICATE_ANSWER_CONTENT") return res.status(400).json({ message: "Answers content must be unique inside a question" });
		if (error.message === "SINGLE_CHOICE_REQUIRES_ONE_CORRECT_ANSWER") return res.status(400).json({ message: "Single choice requires exactly one correct answer" });
		if (error.message === "MULTIPLE_CHOICE_REQUIRES_CORRECT_ANSWER") return res.status(400).json({ message: "Multiple choice requires at least one correct answer" });

		console.error("Add question error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetQuizQuestions = async (req, res) => {
	const { quiz_id } = req.params ?? {};
	try {
		const questions = await getQuizQuestions(quiz_id, req.user._id, req.user.role);
		return res.status(200).json(questions);
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID") return res.status(400).json({ message: "Invalid quiz ID format" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment in this course required" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Access denied" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleUpdateQuestion = async (req, res) => {
	const { quiz_id, question_id } = req.params ?? {};
	try {
		const question = await updateQuestion(quiz_id, question_id, req.body, req.user._id, req.user.role);
		return res.status(200).json({ message: "Question updated successfully", question });
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID" || error.message === "INVALID_QUESTION_ID") return res.status(400).json({ message: "Invalid ID format specified" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND" || error.message === "QUESTION_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Action denied" });
		if (error.message === "QUIZ_HAS_ACTIVE_ATTEMPTS") return res.status(409).json({ message: "Quiz cannot be modified while students are taking it" });
		if (error.message === "NO_FIELDS_TO_UPDATE") return res.status(400).json({ message: "At least one question field is required to update" });
        if (["INVALID_QUESTION_CONTENT", "INVALID_QUESTION_TYPE", "INVALID_POINT", "INVALID_ANSWERS"].includes(error.message)) {
			return res.status(400).json({ message: "Invalid question validation layout fields" });
		}
		if (error.message === "DUPLICATE_ANSWER_CONTENT") return res.status(400).json({ message: "Answers content must be unique inside a question" });
		if (error.message === "SINGLE_CHOICE_REQUIRES_ONE_CORRECT_ANSWER") return res.status(400).json({ message: "Single choice requires exactly one correct answer" });
		if (error.message === "MULTIPLE_CHOICE_REQUIRES_CORRECT_ANSWER") return res.status(400).json({ message: "Multiple choice requires at least one correct answer" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleDeleteQuestion = async (req, res) => {
	const { quiz_id, question_id } = req.params ?? {};
	try {
		const result = await deleteQuestion(quiz_id, question_id, req.user._id, req.user.role);
		return res.status(200).json(result);
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID" || error.message === "INVALID_QUESTION_ID") return res.status(400).json({ message: "Invalid ID format specified" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND" || error.message === "QUESTION_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Action denied" });
		if (error.message === "QUIZ_HAS_ACTIVE_ATTEMPTS") return res.status(409).json({ message: "Quiz cannot be modified while students are taking it" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleStartQuiz = async (req, res) => {
	const { quiz_id } = req.params ?? {};
	try {
		const result = await startQuiz(quiz_id, req.user._id);
		return res.status(201).json(result);
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID") return res.status(400).json({ message: "Invalid quiz ID format" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment required to start this quiz" });
		if (error.message === "QUIZ_HAS_NO_QUESTIONS") return res.status(409).json({ message: "Cannot start a quiz that has no questions" });

		console.error("Start quiz error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleSubmitQuiz = async (req, res) => {
	const { attempt_id } = req.params ?? {}; 
	const { answers } = req.body ?? {};
	try {
		const result = await submitQuiz(attempt_id, answers, req.user._id);
		return res.status(200).json(result);
	} catch (error) {
		if (error.message === "INVALID_ATTEMPT_ID") return res.status(400).json({ message: "Invalid attempt ID format" });
		if (error.message === "ATTEMPT_NOT_FOUND" || error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment required to submit this quiz" });
		if (error.message === "ATTEMPT_ACCESS_DENIED") return res.status(403).json({ message: "Forbidden - You cannot submit this attempt" });
		if (error.message === "ATTEMPT_ALREADY_SUBMITTED") return res.status(409).json({ message: "This attempt has already been submitted" });
		if (error.message === "QUIZ_TIME_EXPIRED") return res.status(400).json({ message: "Time limit expired. Submission rejected" });
		if (error.message === "INVALID_SUBMISSION") return res.status(400).json({ message: "Invalid answers payload structure" });

		console.error("Submit quiz error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetQuizAttempts = async (req, res) => {
	const { quiz_id } = req.params ?? {};
	try {
		const attempts = await getQuizAttempts(quiz_id, req.user._id, req.user.role);
		return res.status(200).json(attempts);
	} catch (error) {
		if (error.message === "INVALID_QUIZ_ID") return res.status(400).json({ message: "Invalid quiz ID format" });
		if (error.message === "QUIZ_NOT_FOUND" || error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Resource not found" });
		if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Active enrollment required to view attempts" });
		if (error.message === "FORBIDDEN_QUIZ_ACTION") return res.status(403).json({ message: "Forbidden - Access denied" });

		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetAttemptById = async (req, res) => {
	const { attempt_id } = req.params ?? {};
	try {
		const attempt = await getAttemptById(attempt_id, req.user._id, req.user.role);
		return res.status(200).json(attempt);
	} catch (error) {
		if (error.message === "INVALID_ATTEMPT_ID") return res.status(400).json({ message: "Invalid attempt ID format" });
		if (error.message === "ATTEMPT_NOT_FOUND") return res.status(404).json({ message: "Quiz attempt history not found" });
		if (error.message === "ATTEMPT_ACCESS_DENIED") return res.status(403).json({ message: "Forbidden - You do not have permission to view this attempt details" });
        if (error.message === "ACTIVE_ENROLLMENT_REQUIRED") return res.status(403).json({ message: "Forbidden - Active enrollment required to view attempt history" });

		return res.status(500).json({ message: "Internal server error" });
	}
};
