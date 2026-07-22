import mongoose from "mongoose";
import User from "../models/User.model.js";
import { validateOwnProfileAvatarKey } from "./file.service.js";

const allowedRoles = ["student", "tutor", "admin"];
const allowedAccountStatuses = ["pending", "active", "blocked"];

export const getUsers = async ({ role, account_status }) => {
	if (role !== undefined && !allowedRoles.includes(role)) throw new Error("INVALID_USER_ROLE");

	if (account_status !== undefined && !allowedAccountStatuses.includes(account_status)) {
		throw new Error("INVALID_ACCOUNT_STATUS");
	}

	const filter = {};
	if (role !== undefined) filter.role = role;
	if (account_status !== undefined) filter.account_status = account_status;

	return User.find(filter)
		.select("full_name email role account_status createdAt updatedAt")
		.sort({ createdAt: -1 });
};

export const updateAccountStatus = async (userId, accountStatus) => {
	if (!mongoose.isValidObjectId(userId)) throw new Error("INVALID_USER_ID");

	if (!["active", "blocked"].includes(accountStatus)) throw new Error("INVALID_ACCOUNT_STATUS");

	const user = await User.findById(userId);
	if (!user) throw new Error("USER_NOT_FOUND");

	if (!["student", "tutor"].includes(user.role)) throw new Error("TARGET_USER_NOT_MANAGEABLE");

	user.account_status = accountStatus;
	await user.save();
	return {
		id: user._id,
		full_name: user.full_name,
		email: user.email,
		role: user.role,
		account_status: user.account_status,
		created_at: user.createdAt,
		updated_at: user.updatedAt,
	};
};

export const updateOwnProfile = async (userId, { full_name, avatar_key } = {}) => {
	if (full_name === undefined && avatar_key === undefined) throw new Error("EMPTY_PROFILE_UPDATE");

	const user = await User.findById(userId);
	if (!user) throw new Error("USER_NOT_FOUND");

	if (full_name !== undefined) {
		if (typeof full_name !== "string") throw new Error("INVALID_FULL_NAME");
		const normalizedName = full_name.trim();
		if (normalizedName.length < 2 || normalizedName.length > 100) throw new Error("INVALID_FULL_NAME");
		user.full_name = normalizedName;
	}

	if (avatar_key !== undefined) {
		if (avatar_key === null || avatar_key === "") {
			user.avatar_key = "";
		} else {
			user.avatar_key = await validateOwnProfileAvatarKey(user._id, avatar_key);
		}
	}

	await user.save();
	return {
		id: user._id,
		full_name: user.full_name,
		email: user.email,
		role: user.role,
		account_status: user.account_status,
		avatar_key: user.avatar_key,
		created_at: user.createdAt,
		updated_at: user.updatedAt,
	};
};
