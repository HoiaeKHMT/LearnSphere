import mongoose from "mongoose";

const RequestMetricSchema = new mongoose.Schema(
	{
		date: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		total_requests: {
			type: Number,
			default: 0,
			min: 0,
		},
		failed_requests: {
			type: Number,
			default: 0,
			min: 0,
		},
		total_duration_ms: {
			type: Number,
			default: 0,
			min: 0,
		},
		unique_user_ids: {
			type: [mongoose.Schema.Types.ObjectId],
			default: [],
		},
	},
	{ timestamps: true },
);

const RequestMetric = mongoose.model("RequestMetric", RequestMetricSchema);
export default RequestMetric;
