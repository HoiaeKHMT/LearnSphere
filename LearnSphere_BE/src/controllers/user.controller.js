import { getUsers, updateAccountStatus, updateOwnProfile } from "../services/user.service.js";

export const handleGetUsers = async (req, res) => {
	const { role, account_status } = req.query ?? {};
	try {
		const users = await getUsers({ role, account_status });
		return res.status(200).json(users);
	} catch (error) {
		if (error.message === "INVALID_USER_ROLE") return res.status(400).json({ message: "Invalid user role" });
		if (error.message === "INVALID_ACCOUNT_STATUS") return res.status(400).json({ message: "Invalid account status" });

		console.error("Get users error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleUpdateTutorAccountStatus = async (req, res) => {
	const { user_id } = req.params ?? {};
	const { account_status } = req.body ?? {};

	if (typeof account_status !== "string") {
		return res.status(400).json({
			message: "account_status is required and must be a string",
		});
	}

	try {
		const user = await updateAccountStatus(user_id, account_status);
		const message =
			account_status === "active"
				? "Account activated successfully"
				: "Account blocked successfully";

		return res.status(200).json({
			message,
			user,
		});
	} catch (error) {
		if (error.message === "INVALID_USER_ID") {
			return res.status(400).json({ message: "Invalid user ID format" });
		}

		if (error.message === "INVALID_ACCOUNT_STATUS") {
			return res.status(400).json({
				message: "account_status must be active or blocked",
			});
		}

		if (error.message === "USER_NOT_FOUND") {
			return res.status(404).json({ message: "User not found" });
		}

		if (error.message === "TARGET_USER_NOT_MANAGEABLE") {
			return res.status(409).json({
				message: "This endpoint can only update student or tutor accounts",
			});
		}

		console.error("Update account status error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const handleUpdateOwnProfile = async (req, res) => {
	try {
		const user = await updateOwnProfile(req.user._id, req.body);
		return res.status(200).json({ message: "Profile updated successfully", user });
	} catch (error) {
		if (error.message === "EMPTY_PROFILE_UPDATE") return res.status(400).json({ message: "full_name or avatar_key is required" });
		if (error.message === "INVALID_FULL_NAME") return res.status(400).json({ message: "full_name must contain 2 to 100 characters" });
		if (["INVALID_AVATAR_KEY", "INVALID_FILE_TYPE", "INVALID_FILE_SIZE"].includes(error.message)) {
			return res.status(400).json({ message: "Invalid profile avatar" });
		}
		if (error.message === "FILE_TOO_LARGE") return res.status(413).json({ message: "Profile avatar exceeds 5 MB" });
		if (error.message === "FILE_NOT_FOUND_IN_S3") return res.status(404).json({ message: "Uploaded profile avatar was not found" });
		if (error.message === "USER_NOT_FOUND") return res.status(404).json({ message: "User not found" });
		if (error.message === "S3_HEAD_FAILED") return res.status(502).json({ message: "Unable to verify profile avatar with S3" });

		console.error("Update own profile error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
