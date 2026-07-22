import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema(
	{
		content: {
			type: String,
			required: true,
			trim: true,
		},
		is_correct: {
			type: Boolean,
			required: true,
			default: false,
		},
	},
	{ _id: true },
);

const QuestionSchema = new mongoose.Schema(
	{
		content: {
			type: String,
			required: true,
			trim: true,
		},
		question_type: {
			type: String,
			enum: ["single_choice", "multiple_choice"],
			default: "single_choice",
		},
		point: {
			type: Number,
			default: 1,
			min: 0.01,
		},
		answers: {
			type: [AnswerSchema],
			default: [],
		},
	},
	{ _id: true },
);

const QuizSchema = new mongoose.Schema(
	{
		course_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Course",
			required: true,
			index: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			default: "",
		},
		time_limit: {
			type: Number,
			default: 15,
			min: 1,
		},
		difficulty: {
			type: String,
			enum: ["basic", "medium", "advanced"],
			default: "basic",
		},
		questions: {
			type: [QuestionSchema],
			default: [],
		},
	},
	{ timestamps: true },
);

const Quiz = mongoose.model("Quiz", QuizSchema);
export default Quiz;
