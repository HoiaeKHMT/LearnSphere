import {
	createPresignedUpload,
	createPresignedDownload,
	createCourseThumbnailDownload,
	createProfileAvatarDownload,
	createProfileAvatarUpload,
} from "../services/file.service.js";

export const handleCreateProfileAvatarUpload = async (req, res) => {
	try {
		return res.status(200).json(await createProfileAvatarUpload(req.body, req.user._id));
	} catch (error) {
		if (["INVALID_FILE_REQUEST", "INVALID_FILE_NAME", "INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) {
			return res.status(400).json({ message: error.message });
		}
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Profile avatar exceeds 5 MB" });

		console.error("Create profile avatar upload URL error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetProfileAvatar = async (req, res) => {
	try {
		return res.status(200).json(await createProfileAvatarDownload(req.user._id));
	} catch (error) {
		if (["FILE_NOT_FOUND_IN_RESOURCE", "FILE_NOT_FOUND_IN_S3", "USER_NOT_FOUND"].includes(error.message)) {
			return res.status(404).json({ message: "Profile avatar not found" });
		}
		if (["INVALID_AVATAR_KEY", "INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) {
			return res.status(400).json({ message: "Invalid profile avatar" });
		}
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Stored profile avatar exceeds 5 MB" });
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify profile avatar with S3" });

		console.error("Create profile avatar download URL error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleCreatePresignedUpload = async (req, res) => {
	try {
		const result = await createPresignedUpload(
			req.body,
			req.user._id,
			req.user.role,
		);
		return res.status(200).json(result);
	} catch (error) {
		if (["INVALID_FILE_REQUEST", "INVALID_FILE_NAME", "INVALID_UPLOAD_FOLDER",
				"INVALID_FILE_TYPE", "INVALID_FILE_SIZE", "INVALID_COURSE_ID",
			].includes(error.message)) {
			return res.status(400).json({ message: error.message });
		}
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "File exceeds the allowed size" });
		if (error.message === "COURSE_NOT_FOUND") return res.status(404).json({ message: "Course not found" });
		if (error.message === "FORBIDDEN_FILE_ACTION") return res.status(403).json({message: "You cannot upload files to this course"});
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify file with S3" });

		console.error("Create presigned upload error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleCreatePresignedDownload = async (req, res) => {
	try {
		const result = await createPresignedDownload(
			{
				lesson_id: req.query.lesson_id,
				target_type: req.query.target_type,
			},
			req.user._id,
			req.user.role,
		);
		return res.status(200).json(result);
	} catch (error) {
		if (["INVALID_LESSON_ID", "INVALID_TARGET_TYPE", "INVALID_VIDEO_KEY", "INVALID_DOCUMENT_KEY",
			"INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) {
			return res.status(400).json({ message: error.message });
		}
		if (["COURSE_NOT_FOUND", "LESSON_NOT_FOUND", "FILE_NOT_FOUND_IN_RESOURCE", "FILE_NOT_FOUND_IN_S3"].includes(error.message)) {
			return res.status(404).json({ message: "Requested file or resource not found" });
		}
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Stored file exceeds the allowed size" });
		if (["FORBIDDEN_FILE_ACTION", "ACTIVE_ENROLLMENT_REQUIRED"].includes(error.message)) {
			return res.status(403).json({message: "You do not have permission to access this file"});
		}
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify file with S3" });

		console.error("Create presigned download error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleGetCourseThumbnail = async (req, res) => {
	try {
		const result = await createCourseThumbnailDownload(req.params.course_id);
		return res.status(200).json(result);
	} catch (error) {
		if (["INVALID_COURSE_ID", "INVALID_THUMBNAIL_KEY", "INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) {
			return res.status(400).json({ message: error.message });
		}
		if (["COURSE_NOT_FOUND", "FILE_NOT_FOUND_IN_RESOURCE", "FILE_NOT_FOUND_IN_S3"].includes(error.message)) {
			return res.status(404).json({ message: "Course thumbnail not found" });
		}
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Stored thumbnail exceeds the allowed size" });
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify thumbnail with S3" });

		console.error("Create course thumbnail URL error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
