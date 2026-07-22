import { getSystemStats } from "../services/stats.service.js";

export const handleGetSystemStats = async (req, res) => {
	try {
		const stats = await getSystemStats();
		return res.status(200).json(stats);
	} catch (error) {
		console.error("Get system stats error:", error);
		return res.status(500).json({ message: "Unable to load system statistics" });
	}
};
