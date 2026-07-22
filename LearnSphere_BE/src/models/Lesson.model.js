import mongoose from "mongoose";

const LessonSchema = new mongoose.Schema(
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
		content: {
			type: String,
			default: "",
		},
		video_key: {
			type: String,
			default: "",
			trim: true,
		},
		document_key: {
			type: String,
			default: "",
			trim: true,
		},
		ai_document_text: {
			type: String,
			default: "",
			select: false,
		},
		ai_index_status: {
			type: String,
			enum: ["not_indexed", "processing", "ready", "partial", "failed"],
			default: "not_indexed",
		},
		ai_indexed_at: {
			type: Date,
			default: null,
		},
		ai_index_error: {
			type: String,
			default: "",
		},
		ai_indexed_document_key: {
			type: String,
			default: "",
			select: false,
		},
		ai_summary: {
			type: String,
			default: "",
			select: false,
		},
		ai_summary_document_key: {
			type: String,
			default: "",
			select: false,
		},
		ai_summary_model_id: {
			type: String,
			default: "",
			select: false,
		},
		ai_summary_stop_reason: {
			type: String,
			default: "",
			select: false,
		},
		ai_summary_input_tokens: {
			type: Number,
			default: 0,
			min: 0,
			select: false,
		},
		ai_summary_output_tokens: {
			type: Number,
			default: 0,
			min: 0,
			select: false,
		},
		ai_summary_generated_at: {
			type: Date,
			default: null,
			select: false,
		},
		order_index: {
			type: Number,
			required: true,
			min: 1,
			validate: Number.isInteger,
		},
	},
	{ timestamps: true },
);

LessonSchema.index({ course_id: 1, order_index: 1 }, { unique: true });

const Lesson = mongoose.model("Lesson", LessonSchema);
export default Lesson;
