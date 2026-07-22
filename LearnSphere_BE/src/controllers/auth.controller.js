import { login, signup, forgotPassword, resetPassword } from "../services/auth.service.js";

export const handleSignup = async (req, res) => {
	const { full_name, email, password, role } = req.body ?? {};

	if (typeof full_name !== "string" || typeof email !== "string" || typeof password !== "string" ||
		!full_name.trim() || !email.trim() || !password || !["student", "tutor"].includes(role)) {
		return res.status(400).json({ message: "Valid full_name, email, password and role are required" });
	}

	try {
		const result = await signup(full_name, email, password, role);
		return res.status(201).json(result); 

	} catch (error) {
		if (error.message === "EMAIL_ALREADY_EXISTS" || error.code === 11000) {
			return res.status(409).json({ message: "Email is already registered" });
		}

        if (error.message === "INVALID_ROLE") {
			return res.status(400).json({ message: "Role must be student or tutor" });
		}

		if (error.message === "INVALID_EMAIL_FORMAT") {
			return res.status(400).json({ message: "Invalid email format" });
		}

		if (error.message === "PASSWORD_TOO_SHORT") {
			return res.status(400).json({ message: "Password must be at least 6 characters long" });
		}

		console.error("Signup error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleLogin = async (req, res) => {
	const { email, password } = req.body ?? {};

	if (typeof email !== "string" || typeof password !== "string" ||
		!email.trim() || !password) {
		return res.status(400).json({ message: "Valid email and password are required" });
	}

	try {
		const result = await login(email, password);
		return res.status(200).json(result);

	} catch (error) {
		if (error.message === "USER_NOT_FOUND" || error.message === "INCORRECT_PASSWORD") {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		if (error.message === "INVALID_EMAIL_FORMAT") {
			return res.status(400).json({ message: "Invalid email format" });
		}

        if (error.message === "ACCOUNT_PENDING") {
            return res.status(403).json({ message: "Tutor account is waiting for admin approval" });
        }
        
        if (error.message === "ACCOUNT_BLOCKED") {
            return res.status(403).json({ message: "Account has been blocked" });
        }

		console.error("Login error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


export const handleGetMe = async (req, res) => {
    return res.status(200).json({
		id: req.user._id,
		full_name: req.user.full_name,
		email: req.user.email,
		role: req.user.role,
        account_status: req.user.account_status,
		avatar_key: req.user.avatar_key,
		created_at: req.user.createdAt,
		updated_at: req.user.updatedAt,
	});
};

export const handleForgotPassword = async (req, res) => {
	const { email } = req.body ?? {};

	if (typeof email !== "string" || !email.trim()) {
		return res.status(400).json({ message: "Valid email is required" });
	}

	try {
		await forgotPassword(email);
		return res.status(200).json({ message: "If the email exists, a password reset link has been sent" });
	} catch (error) {
		console.error("Forgot password error:", error);
		return res.status(500).json({ message: "Unable to send reset email" });
	}
};

export const handleResetPassword = async (req, res) => {
	const { password } = req.body ?? {};
	const { token } = req.params ?? {};

	if (typeof password !== "string" || !password) {
		return res.status(400).json({ message: "Valid password is required" });
	}

	try {
		await resetPassword(token, password);
		return res.status(200).json({ message: "Password reset successfully" });
	} catch (error) {
		if (error.message === "PASSWORD_TOO_SHORT") {
			return res.status(400).json({ message: "Password must be at least 6 characters long" });
		}

		if (error.message === "INVALID_OR_EXPIRED_RESET_TOKEN" ) {
			return res.status(400).json({ message: "Reset token is invalid or expired" });
		}

		return res.status(500).json({ message: "Internal server error" });
	}
};
