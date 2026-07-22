import path from "node:path";
import mongoose from "mongoose";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { createWorker, OEM, PSM } from "tesseract.js";
import vietnameseOCRData from "@tesseract.js-data/vie";
import Course from "../models/Course.model.js";
import Lesson from "../models/Lesson.model.js";
import { downloadS3ObjectBuffer } from "./file.service.js";

const MB = 1024 * 1024;

const readPositiveInteger = (value, fallback) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeExtractedText = (value) => value
	.replace(/\u0000/g, "")
	.replace(/[ \t]+\n/g, "\n")
	.replace(/\n{3,}/g, "\n\n")
	.trim();

const limitStoredText = (text) => {
	const maxChars = readPositiveInteger(process.env.AI_INDEX_MAX_CHARS, 200000);
	return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[Nội dung đã được cắt bớt do giới hạn lập chỉ mục]` : text;
};

const extractScannedPdfText = async (parser) => {
	const maxPages = readPositiveInteger(process.env.AI_PDF_OCR_MAX_PAGES, 20);
	const screenshots = await parser.getScreenshot({
		first: maxPages,
		desiredWidth: 1800,
		imageDataUrl: false,
		imageBuffer: true,
	});
	if (!screenshots.pages.length) throw new Error("AI_DOCUMENT_TEXT_EMPTY");

	const worker = await createWorker(vietnameseOCRData.code, OEM.LSTM_ONLY, {
		langPath: vietnameseOCRData.langPath,
		gzip: vietnameseOCRData.gzip,
	});
	try {
		await worker.setParameters({
			tessedit_pageseg_mode: PSM.AUTO,
			preserve_interword_spaces: "1",
		});
		const parts = [];
		for (const page of screenshots.pages) {
			const result = await worker.recognize(Buffer.from(page.data));
			const pageText = normalizeExtractedText(result.data.text || "");
			if (pageText) parts.push(`[Trang ${page.pageNumber}]\n${pageText}`);
		}
		if (!parts.length) throw new Error("AI_DOCUMENT_TEXT_EMPTY");
		return parts.join("\n\n");
	} finally {
		await worker.terminate();
	}
};

const extractDocumentText = async (fileKey) => {
	const maxBytes = readPositiveInteger(process.env.AI_DOCUMENT_MAX_BYTES, 20 * MB);
	const { buffer } = await downloadS3ObjectBuffer(fileKey, maxBytes);
	const extension = path.extname(fileKey).toLowerCase();

	let text;
	if (extension === ".pdf") {
		const parser = new PDFParse({ data: new Uint8Array(buffer) });
		try {
			const result = await parser.getText();
			text = result.text || "";
			const minimumTextChars = readPositiveInteger(process.env.AI_PDF_OCR_MIN_TEXT_CHARS, 200);
			if (normalizeExtractedText(text).length < minimumTextChars) {
				try {
					text = await extractScannedPdfText(parser);
				} catch (error) {
					if (error.message === "AI_DOCUMENT_TEXT_EMPTY") throw error;
					throw new Error("AI_OCR_FAILED", { cause: error });
				}
			}
		} finally {
			await parser.destroy();
		}
	} else if (extension === ".docx") {
		const result = await mammoth.extractRawText({ buffer });
		text = result.value;
	} else {
		throw new Error("AI_DOCUMENT_TYPE_UNSUPPORTED");
	}

	const normalized = normalizeExtractedText(text || "");
	if (!normalized) throw new Error("AI_DOCUMENT_TEXT_EMPTY");
	return limitStoredText(normalized);
};

const getIssueMessage = (source, error) => {
	const messages = {
		AI_DOCUMENT_TOO_LARGE: "Tài liệu vượt quá giới hạn xử lý",
		AI_DOCUMENT_TYPE_UNSUPPORTED: "Định dạng tài liệu chưa được hỗ trợ",
		AI_DOCUMENT_TEXT_EMPTY: "Không trích xuất được chữ từ tài liệu; PDF có thể chỉ chứa ảnh scan",
		AI_OCR_FAILED: "OCR cục bộ không thể xử lý PDF scan",
		S3_READ_FAILED: "Không đọc được file từ S3",
	};
	return `${source}: ${messages[error.message] || "Không thể xử lý file"}`;
};

export const indexLessonFilesForAI = async (lessonId, userId, userRole) => {
	if (!mongoose.isValidObjectId(lessonId)) throw new Error("INVALID_LESSON_ID");
	const lesson = await Lesson.findById(lessonId).select("+ai_document_text +ai_indexed_document_key");
	if (!lesson) throw new Error("LESSON_NOT_FOUND");

	const course = await Course.findOne({ _id: lesson.course_id, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");
	const isOwner = course.created_by.toString() === userId.toString();
	if (userRole !== "tutor" || !isOwner) throw new Error("FORBIDDEN_LESSON_ACTION");
	if (!lesson.document_key) throw new Error("LESSON_DOCUMENT_REQUIRED");
	if (lesson.ai_index_status === "processing") throw new Error("AI_INDEX_IN_PROGRESS");

	lesson.ai_index_status = "processing";
	lesson.ai_index_error = "";
	await lesson.save();

	const issues = [];
	let requested = 0;
	let succeeded = 0;

	if (lesson.document_key) {
		requested += 1;
		try {
			if (lesson.ai_indexed_document_key !== lesson.document_key || !lesson.ai_document_text?.trim()) {
				lesson.ai_document_text = await extractDocumentText(lesson.document_key);
				lesson.ai_indexed_document_key = lesson.document_key;
			}
			succeeded += 1;
		} catch (error) {
			lesson.ai_document_text = "";
			lesson.ai_indexed_document_key = "";
			issues.push(getIssueMessage("Tài liệu", error));
		}
	} else {
		lesson.ai_document_text = "";
		lesson.ai_indexed_document_key = "";
	}

	lesson.ai_index_status = succeeded === requested
		? "ready"
		: "failed";
	lesson.ai_indexed_at = new Date();
	lesson.ai_index_error = issues.join("; ");
	await lesson.save();

	return {
		lesson_id: lesson._id,
		status: lesson.ai_index_status,
		indexed_at: lesson.ai_indexed_at,
		document_indexed: Boolean(lesson.ai_document_text),
		issues,
	};
};
