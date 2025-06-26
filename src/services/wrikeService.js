const WrikeConnection = require("./wrike/wrikeConnection");
const WrikeTasks = require("./wrike/wrikeTasks");

class WrikeService {
	constructor() {
		this.tasks = new WrikeTasks();

		this.connection = new WrikeConnection();
	}

	async createTask(taskDetails) {
		return await this.tasks.createTask(taskDetails);
	}

	async updateTask(taskId, updates) {
		return await this.tasks.updateTask(taskId, updates);
	}

	async testConnection() {
		return await this.connection.testConnection();
	}

	async createTaskInFolder(taskDetails, folderId) {
		return await this.tasks.createTaskInFolder(taskDetails, folderId);
	}

	async updateTaskStatus(taskId, status) {
		try {
			const wrikeTasks = new WrikeTasks();

			// Map status to Wrike workflow status
			const statusMapping = {
				New: "Active", // Adjust these based on your Wrike workflow
				Planned: "Active",
				InProgress: "Active",
				InReview: "Active",
				Completed: "Completed",
			};

			const wrikeStatus = statusMapping[status] || "Active";

			const updates = {
				status: wrikeStatus,
				customStatus: status, // If you're using custom statuses
			};

			const result = await wrikeTasks.updateTask(taskId, updates);
			return result;
		} catch (error) {
			console.error("Error updating task status:", error);
			throw error;
		}
	}

	async getTaskDetails(taskId) {
		try {
			const response = await this.tasks.client.get(`/tasks/${taskId}`);
			return response.data;
		} catch (error) {
			console.error("Error fetching task details:", error);
			throw error;
		}
	}
}

// Export both the class and individual functions for backwards compatibility
const wrikeService = new WrikeService();

module.exports = {
	WrikeService,
	createTask: (taskDetails) => wrikeService.createTask(taskDetails),
	updateTask: (taskId, updates) => wrikeService.updateTask(taskId, updates),
	testWrikeConnection: () => wrikeService.testConnection(),
	createTaskWithFolder: (taskDetails, folderId) =>
		wrikeService.createTaskInFolder(taskDetails, folderId),
	updateTaskStatus: (taskId, status) =>
		wrikeService.updateTaskStatus(taskId, status),
	getTaskDetails: (taskId) => wrikeService.getTaskDetails(taskId),
};
