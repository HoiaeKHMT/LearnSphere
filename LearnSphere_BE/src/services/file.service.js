import crypto from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import s3Client from "../config/s3.js";
import Course from "../models/Course.model.js";
import Lesson from "../models/Lesson.model.js";
import Enrollment from "../models/Enrollment.model.js";
import User from "../models/User.model.js";

const MB = 1024 * 1024;

const uploadRules = {
	"profile-avatars": {
		contentTypes: {
			"image/jpeg": [".jpg", ".jpeg"],
			"image/png": [".png"],
			"image/webp": [".webp"],
		},
		maxSizeBytes: 5 * MB,
	},
	thumbnails: {
		contentTypes: {
			"image/jpeg": [".jpg", ".jpeg"],
			"image/png": [".png"],
			"image/webp": [".webp"],
		},
		maxSizeBytes: 5 * MB,
	},
	"lessons/videos": {
		contentTypes: {
			"video/mp4": [".mp4"],
			"video/webm": [".webm"],
		},
		maxSizeBytes: 500 * MB,
	},
	"lessons/documents": {
		contentTypes: {
			"application/pdf": [".pdf"],
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
		},
		maxSizeBytes: 20 * MB,
	},
};

const getExpirySeconds = (rawValue, fallback, maximum) => {
	const parsed = Number(rawValue);
	return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
		? parsed
		: fallback;
};

const validateExtensionAndContentType = (fileName, contentType, rule) => {
	const extension = path.extname(fileName).toLowerCase();
	const allowedExtensions = rule.contentTypes[contentType];

	if (!allowedExtensions || !allowedExtensions.includes(extension)) {
		throw new Error("INVALID_FILE_TYPE");
	}
};

const cleanFileName = (fileName) => {
	const extension = path.extname(fileName).toLowerCase();
	const baseName = path
		.basename(fileName, extension)
		.replace(/[^a-zA-Z0-9-_]/g, "-")
		.slice(0, 100);

	if (!baseName || !extension) throw new Error("INVALID_FILE_NAME");
	return `${baseName}${extension}`;
};

const checkCourseOwner = async (courseId, userId, userRole) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	const isOwner = course.created_by.toString() === userId.toString();
	if (userRole !== "admin" && !isOwner) throw new Error("FORBIDDEN_FILE_ACTION");

	return course;
};

export const createPresignedUpload = async ({ course_id, file_name, content_type, file_size, folder } = {}, userId, userRole) => {
	await checkCourseOwner(course_id, userId, userRole);
	if (typeof file_name !== "string" || typeof content_type !== "string" || typeof folder !== "string") {
		throw new Error("INVALID_FILE_REQUEST");
	}

	const rule = uploadRules[folder];
	if (!rule) throw new Error("INVALID_UPLOAD_FOLDER");
	validateExtensionAndContentType(file_name, content_type, rule);
	if (!Number.isSafeInteger(file_size) || file_size < 1) throw new Error("INVALID_FILE_SIZE");
	if (file_size > rule.maxSizeBytes) throw new Error("FILE_TOO_LARGE");

	const safeFileName = cleanFileName(file_name);
	const uniqueName = `${crypto.randomUUID()}-${safeFileName}`;

	const fileKey = `courses/${course_id}/${folder}/${uniqueName}`;

	const command = new PutObjectCommand({
		Bucket: process.env.AWS_S3_BUCKET,
		Key: fileKey,
		ContentType: content_type,
		ContentLength: file_size,
	});

	const expiresIn = getExpirySeconds(process.env.S3_UPLOAD_URL_EXPIRES_IN, 300, 900);

	const uploadUrl = await getSignedUrl(s3Client, command, {expiresIn});

	return {
		upload_url: uploadUrl,
		file_key: fileKey,
		content_type,
		file_size,
		max_size_bytes: rule.maxSizeBytes,
		expires_in: expiresIn,
	};
};

export const createProfileAvatarUpload = async ({ file_name, content_type, file_size } = {}, userId) => {
	if (typeof file_name !== "string" || typeof content_type !== "string") {
		throw new Error("INVALID_FILE_REQUEST");
	}

	const rule = uploadRules["profile-avatars"];
	validateExtensionAndContentType(file_name, content_type, rule);
	if (!Number.isSafeInteger(file_size) || file_size < 1) throw new Error("INVALID_FILE_SIZE");
	if (file_size > rule.maxSizeBytes) throw new Error("FILE_TOO_LARGE");

	const safeFileName = cleanFileName(file_name);
	const fileKey = `users/${userId}/avatars/${crypto.randomUUID()}-${safeFileName}`;
	const command = new PutObjectCommand({
		Bucket: process.env.AWS_S3_BUCKET,
		Key: fileKey,
		ContentType: content_type,
		ContentLength: file_size,
	});
	const expiresIn = getExpirySeconds(process.env.S3_UPLOAD_URL_EXPIRES_IN, 300, 900);
	const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

	return {
		upload_url: uploadUrl,
		file_key: fileKey,
		content_type,
		file_size,
		max_size_bytes: rule.maxSizeBytes,
		expires_in: expiresIn,
	};
};

const validateProfileAvatarKey = async (userId, fileKey) => {
	if (typeof fileKey !== "string" || !fileKey.trim()) throw new Error("INVALID_AVATAR_KEY");

	const normalizedKey = fileKey.trim();
	const expectedPrefix = `users/${userId}/avatars/`;
	if (normalizedKey.includes("..") || normalizedKey.includes("\\") || !normalizedKey.startsWith(expectedPrefix)) {
		throw new Error("INVALID_AVATAR_KEY");
	}

	let objectMetadata;
	try {
		objectMetadata = await s3Client.send(new HeadObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET,
			Key: normalizedKey,
		}));
	} catch (error) {
		if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") {
			throw new Error("FILE_NOT_FOUND_IN_S3");
		}
		throw new Error("S3_HEAD_FAILED", { cause: error });
	}

	const rule = uploadRules["profile-avatars"];
	const contentType = objectMetadata.ContentType?.split(";")[0].trim().toLowerCase();
	validateExtensionAndContentType(normalizedKey, contentType, rule);
	if (!Number.isFinite(objectMetadata.ContentLength) || objectMetadata.ContentLength < 1) throw new Error("INVALID_FILE_SIZE");
	if (objectMetadata.ContentLength > rule.maxSizeBytes) throw new Error("FILE_TOO_LARGE");

	return normalizedKey;
};

export const validateOwnProfileAvatarKey = (userId, fileKey) => validateProfileAvatarKey(userId, fileKey);

export const validateStoredFileKey = async ({ courseId, fileKey, folder, invalidKeyError = "INVALID_FILE_KEY" }) => {
	const rule = uploadRules[folder];
	if (!rule || typeof fileKey !== "string" || !fileKey.trim()) {
		throw new Error(invalidKeyError);
	}

	const normalizedKey = fileKey.trim();
	const expectedPrefix = `courses/${courseId}/${folder}/`;
	if (normalizedKey.includes("..") || normalizedKey.includes("\\") || !normalizedKey.startsWith(expectedPrefix)) {
		throw new Error(invalidKeyError);
	}

	let objectMetadata;
	try {
		objectMetadata = await s3Client.send(new HeadObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET,
			Key: normalizedKey,
		}));
	} catch (error) {
		if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") {
			throw new Error("FILE_NOT_FOUND_IN_S3");
		}
		throw new Error("S3_HEAD_FAILED", { cause: error });
	}

	const contentType = objectMetadata.ContentType?.split(";")[0].trim().toLowerCase();
	validateExtensionAndContentType(normalizedKey, contentType, rule);

	if (!Number.isFinite(objectMetadata.ContentLength) || objectMetadata.ContentLength < 1) {
		throw new Error("INVALID_FILE_SIZE");
	}
	if (objectMetadata.ContentLength > rule.maxSizeBytes) throw new Error("FILE_TOO_LARGE");

	return normalizedKey;
};

const createDownloadUrl = async (fileKey) => {
	const command = new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: fileKey });
	const expiresIn = getExpirySeconds(process.env.S3_DOWNLOAD_URL_EXPIRES_IN, 900, 3600);
	const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

	return {
		download_url: downloadUrl,
		file_key: fileKey,
		expires_in: expiresIn,
	};
};

export const createProfileAvatarDownload = async (userId) => {
	const user = await User.findById(userId).select("avatar_key");
	if (!user) throw new Error("USER_NOT_FOUND");
	if (!user.avatar_key) throw new Error("FILE_NOT_FOUND_IN_RESOURCE");

	const validatedKey = await validateProfileAvatarKey(user._id, user.avatar_key);
	return createDownloadUrl(validatedKey);
};

export const createPresignedDownload = async ({ lesson_id, target_type } = {}, userId, userRole) => {
	if (!["video", "document"].includes(target_type)) throw new Error("INVALID_TARGET_TYPE");
	if (!mongoose.isValidObjectId(lesson_id)) throw new Error("INVALID_LESSON_ID");

	const lesson = await Lesson.findById(lesson_id);
	if (!lesson) throw new Error("LESSON_NOT_FOUND");

	const course = await Course.findOne({ _id: lesson.course_id, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");

	if (userRole === "tutor") {
		const isOwner = course.created_by.toString() === userId.toString();
		if (!isOwner) throw new Error("FORBIDDEN_FILE_ACTION");
	}
	if (userRole === "student") {
		const enrollment = await Enrollment.findOne({ user_id: userId, course_id: course._id, status: "active" });
		if (!enrollment) throw new Error("ACTIVE_ENROLLMENT_REQUIRED");
	}

	const folder = target_type === "video" ? "lessons/videos" : "lessons/documents";
	const invalidKeyError = target_type === "video" ? "INVALID_VIDEO_KEY" : "INVALID_DOCUMENT_KEY";
	const fileKey = target_type === "video" ? lesson.video_key : lesson.document_key;
	if (!fileKey) throw new Error("FILE_NOT_FOUND_IN_RESOURCE");

	const validatedKey = await validateStoredFileKey({
		courseId: course._id,
		fileKey,
		folder,
		invalidKeyError,
	});

	return createDownloadUrl(validatedKey);
};

export const createCourseThumbnailDownload = async (courseId) => {
	if (!mongoose.isValidObjectId(courseId)) throw new Error("INVALID_COURSE_ID");

	const course = await Course.findOne({ _id: courseId, is_deleted: false });
	if (!course) throw new Error("COURSE_NOT_FOUND");
	if (!course.thumbnail_key) throw new Error("FILE_NOT_FOUND_IN_RESOURCE");

	const validatedKey = await validateStoredFileKey({
		courseId: course._id,
		fileKey: course.thumbnail_key,
		folder: "thumbnails",
		invalidKeyError: "INVALID_THUMBNAIL_KEY",
	});

	return createDownloadUrl(validatedKey);
};
