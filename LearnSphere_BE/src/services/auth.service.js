import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../models/User.model.js";
import { generateToken } from "../utils/generateToken.js";
import { sendEmail } from "../utils/sendEmail.js";

export const signup = async (full_name, email, password, role) => {
	const normalizedFullName = full_name.trim();
	const normalizedEmail = email.trim().toLowerCase();
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
	if (!emailRegex.test(normalizedEmail)) throw new Error("INVALID_EMAIL_FORMAT");

	if (password.length < 6) throw new Error("PASSWORD_TOO_SHORT");

	const userExists = await User.findOne({ email: normalizedEmail });
	if (userExists) throw new Error("EMAIL_ALREADY_EXISTS");

	const pass_hash = await bcrypt.hash(password, 10);	

	if (!["student", "tutor"].includes(role)) throw new Error("INVALID_ROLE");
	const authenStatus = role === "tutor" ? "pending" : "active";

	const newUser = await User.create({
		full_name: normalizedFullName,
		email: normalizedEmail,
		password_hash: pass_hash,
		role: role, 
		account_status: authenStatus,
	});

	const accessToken = newUser.account_status === "active"
		? generateToken(newUser._id.toString(), newUser.token_version)
		: null;

	return {
		message: "Register successfully",
		access_token: accessToken,
		token_type: accessToken ? "bearer" : null,
		user: {
			id: newUser._id,
			full_name: newUser.full_name,
			email: newUser.email,
			role: newUser.role,
			account_status: newUser.account_status,
			avatar_key: newUser.avatar_key,
		},
	};
};


export const login = async (email, password) => {
	const normalizedEmail = email.trim().toLowerCase();

	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
	if (!emailRegex.test(normalizedEmail)) throw new Error("INVALID_EMAIL_FORMAT");

	const user = await User.findOne({ email: normalizedEmail });
	if (!user) throw new Error("USER_NOT_FOUND");

	const isMatch = await bcrypt.compare(password, user.password_hash);
	if (!isMatch) throw new Error("INCORRECT_PASSWORD");

	if (user.account_status === "pending") throw new Error("ACCOUNT_PENDING");
	if (user.account_status === "blocked") throw new Error("ACCOUNT_BLOCKED");

	const accessToken = generateToken(user._id.toString(), user.token_version ?? 0);

	return {
		access_token: accessToken,
		token_type: "bearer",
		user: {
			id: user._id,
			full_name: user.full_name,
			email: user.email,
			role: user.role,
			avatar_key: user.avatar_key,
		},
	};
};


export const forgotPassword = async (email) => {
	const normalizedEmail = email.trim().toLowerCase();
	const user = await User.findOne({ email: normalizedEmail });
	if (!user) return;

	const resetToken = crypto.randomBytes(32).toString("hex");

	user.reset_password_token = crypto.createHash("sha256").update(resetToken).digest("hex");
	user.reset_password_expires = Date.now() + 15 * 60 * 1000;

	await user.save();

	const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

	try {
		await sendEmail({
			email: user.email,
			subject: "[LEARNSPHERE APP] Reset your password",
			message:
				`Reset your password using this link: ${resetUrl}. ` +
				"The link expires in 15 minutes.",
			html: `
				<p>You requested a password reset.</p>
				<p>
					<a href="${resetUrl}">Reset password</a>
				</p>
				<p>This link expires in 15 minutes.</p>
			`,
		});
	} catch (error) {
		user.reset_password_token = null;
		user.reset_password_expires = null;
		await user.save();

		throw new Error("EMAIL_SEND_FAILED");
	}
};


export const resetPassword = async (token, new_password) => {
	if (new_password.length < 6) throw new Error("PASSWORD_TOO_SHORT");

	const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

	const user = await User.findOne({
		reset_password_token: resetTokenHash,
		reset_password_expires: { $gt: Date.now() },
	}).select( "+reset_password_token +reset_password_expires" );

	if (!user) throw new Error("INVALID_OR_EXPIRED_RESET_TOKEN");

	user.password_hash = await bcrypt.hash(new_password, 10);
	user.token_version = (user.token_version ?? 0) + 1;
	user.reset_password_token = null;
	user.reset_password_expires = null;

	await user.save();
};
