import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import s3Client from "../config/s3.js";
import Course from "../models/Course.model.js";
import Enrollment from "../models/Enrollment.model.js";
import Lesson from "../models/Lesson.model.js";
import Quiz from "../models/Quiz.model.js";
import QuizAttempt from "../models/QuizAttempt.model.js";
import RequestMetric from "../models/RequestMetric.model.js";
import User from "../models/User.model.js";

const S3_CACHE_TTL_MS = 5 * 60 * 1000;
let s3Cache = null;

const getDateKeyDaysAgo = (daysAgo) => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() - daysAgo);
	return date.toISOString().slice(0, 10);
};

const toCountMap = (items, keyName) => Object.fromEntries(items.map((item) => [item[keyName], item.count]));

const getS3StorageStats = async () => {
	if (s3Cache && Date.now() - s3Cache.cachedAt < S3_CACHE_TTL_MS) {
		return s3Cache.value;
	}

	const bucket = process.env.AWS_S3_BUCKET;
	const configuredLimit = Number(process.env.S3_STORAGE_LIMIT_BYTES);
	const capacityBytes = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : null;

	try {
		let continuationToken;
		let usedBytes = 0;
		let objectCount = 0;

		do {
			const response = await s3Client.send(new ListObjectsV2Command({
				Bucket: bucket,
				ContinuationToken: continuationToken,
			}));

			for (const object of response.Contents ?? []) {
				usedBytes += object.Size ?? 0;
				objectCount += 1;
			}

			continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
		} while (continuationToken);

		const value = {
			status: "available",
			used_bytes: usedBytes,
			object_count: objectCount,
			capacity_bytes: capacityBytes,
			usage_percent: capacityBytes ? Math.min(100, Number(((usedBytes / capacityBytes) * 100).toFixed(2))) : null,
			message: capacityBytes ? null : "S3_STORAGE_LIMIT_BYTES is not configured",
		};

		s3Cache = { cachedAt: Date.now(), value };
		return value;
	} catch (error) {
		const value = {
			status: "unavailable",
			used_bytes: null,
			object_count: null,
			capacity_bytes: capacityBytes,
			usage_percent: null,
			message: error?.name === "AccessDenied" ? "IAM role is missing s3:ListBucket permission" : "Unable to read S3 bucket metrics",
		};

		s3Cache = { cachedAt: Date.now(), value };
		return value;
	}
};

export const getSystemStats = async () => {
	const sevenDaysAgo = getDateKeyDaysAgo(6);
	const today = getDateKeyDaysAgo(0);

	const [
		usersByStatusRaw,
		usersByRoleRaw,
		coursesByDeletedRaw,
		enrollmentsByStatusRaw,
		attemptsByStatusRaw,
		totalLessons,
		totalQuizzes,
		dailyMetrics,
		trafficTotals,
		storage,
	] = await Promise.all([
		User.aggregate([{ $group: { _id: "$account_status", count: { $sum: 1 } } }]),
		User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
		Course.aggregate([{ $group: { _id: "$is_deleted", count: { $sum: 1 } } }]),
		Enrollment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
		QuizAttempt.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
		Lesson.countDocuments(),
		Quiz.countDocuments(),
		RequestMetric.find({ date: { $gte: sevenDaysAgo } }).sort({ date: 1 }).lean(),
		RequestMetric.aggregate([
			{
				$group: {
					_id: null,
					total_requests: { $sum: "$total_requests" },
					failed_requests: { $sum: "$failed_requests" },
					total_duration_ms: { $sum: "$total_duration_ms" },
				},
			},
		]),
		getS3StorageStats(),
	]);

	const usersByStatus = toCountMap(usersByStatusRaw, "_id");
	const usersByRole = toCountMap(usersByRoleRaw, "_id");
	const enrollmentsByStatus = toCountMap(enrollmentsByStatusRaw, "_id");
	const attemptsByStatus = toCountMap(attemptsByStatusRaw, "_id");
	const activeCourses = coursesByDeletedRaw.find((item) => item._id === false)?.count ?? 0;
	const deletedCourses = coursesByDeletedRaw.find((item) => item._id === true)?.count ?? 0;
	const totals = trafficTotals[0] ?? { total_requests: 0, failed_requests: 0, total_duration_ms: 0 };
	const todayMetric = dailyMetrics.find((item) => item.date === today);
	const uniqueUsers = new Set(dailyMetrics.flatMap((item) => item.unique_user_ids.map(String)));

	const dailyMap = new Map(dailyMetrics.map((item) => [item.date, item]));
	const dailyRequests = Array.from({ length: 7 }, (_, index) => {
		const date = getDateKeyDaysAgo(6 - index);
		const metric = dailyMap.get(date);
		return {
			date,
			requests: metric?.total_requests ?? 0,
			failed_requests: metric?.failed_requests ?? 0,
			unique_users: metric?.unique_user_ids.length ?? 0,
		};
	});

	return {
		generated_at: new Date().toISOString(),
		traffic: {
			total_requests: totals.total_requests,
			today_requests: todayMetric?.total_requests ?? 0,
			unique_users_7d: uniqueUsers.size,
			failed_requests: totals.failed_requests,
			error_rate_percent: totals.total_requests
				? Number(((totals.failed_requests / totals.total_requests) * 100).toFixed(2))
				: 0,
			average_response_ms: totals.total_requests ? Math.round(totals.total_duration_ms / totals.total_requests) : 0,
			daily_requests: dailyRequests,
		},
		users: {
			total: Object.values(usersByStatus).reduce((sum, count) => sum + count, 0),
			active: usersByStatus.active ?? 0,
			pending: usersByStatus.pending ?? 0,
			blocked: usersByStatus.blocked ?? 0,
			by_role: {
				student: usersByRole.student ?? 0,
				tutor: usersByRole.tutor ?? 0,
				admin: usersByRole.admin ?? 0,
			},
		},
		content: {
			active_courses: activeCourses,
			deleted_courses: deletedCourses,
			total_lessons: totalLessons,
			total_quizzes: totalQuizzes,
			enrollments: {
				active: enrollmentsByStatus.active ?? 0,
				pending: enrollmentsByStatus.pending ?? 0,
			},
			quiz_attempts: {
				in_progress: attemptsByStatus.in_progress ?? 0,
				submitted: attemptsByStatus.submitted ?? 0,
				expired: attemptsByStatus.expired ?? 0,
			},
		},
		storage,
	};
};
