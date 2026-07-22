import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		full_name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		password_hash: {
			type: String,
			required: true,
		},
		role: {
			type: String,
			enum: ["student", "tutor", "admin"],
			default: "student",
		},
		account_status: {
			type: String,
			enum: ["pending", "active", "blocked"],
			default: "active",
		},
		avatar_key: {
			type: String,
			default: "",
			trim: true,
		},
		token_version: {
			type: Number,
			default: 0,
			min: 0,
		},
		reset_password_token: {
			type: String,
			default: null,
			select: false,
		},
		reset_password_expires: {
			type: Date,
			default: null,
			select: false,
		},
	},
	{ timestamps: true },
);

const User = mongoose.model("User", userSchema);
export default User;
