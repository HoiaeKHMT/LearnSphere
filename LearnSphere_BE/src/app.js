import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.route.js";
import courseRoutes from "./routes/course.route.js";
import userRoutes from "./routes/user.route.js";
import lessonRoutes from "./routes/lesson.route.js";
import quizRoutes from "./routes/quiz.route.js";
import quizAttemptRoutes from "./routes/quiz-attempt.route.js";
import fileRoutes from "./routes/file.route.js";
import statsRoutes from "./routes/stats.route.js";
import { trackApiRequest } from "./middleware/request-metrics.middleware.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(trackApiRequest);

app.get("/", (req, res) => {
	res.json({ message: "LearnSphere Platform API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/quiz-attempts", quizAttemptRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/stats", statsRoutes);

export default app;
