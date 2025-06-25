const axios = require("axios");

class WrikeApiService {
	constructor() {
		this.api = axios.create({
			baseURL: process.env.WRIKE_API_URL,
			headers: {
				Authorization: `Bearer ${process.env.WRIKE_ACCESS_TOKEN}`,
			},
		});
	}

	async getProjects() {
		try {
			const response = await this.api.get("/folders");
			return response.data.data.filter((folder) => folder.project);
		} catch (error) {
			console.error("Error fetching Wrike projects:", error);
			throw error;
		}
	}

	async createTask(projectId, taskData) {
		try {
			const payload = {
				title: taskData.title,
				description: taskData.description,
				status: "Active",
			};

			if (taskData.dueDate) {
				payload.dates = {
					due: new Date(taskData.dueDate).toISOString(),
				};
			}

			if (taskData.assigneeWrikeId) {
				payload.responsibles = [taskData.assigneeWrikeId];
			}

			const response = await this.api.post(
				`/folders/${projectId}/tasks`,
				payload
			);
			return response.data.data[0];
		} catch (error) {
			console.error("Error creating Wrike task:", error);
			throw error;
		}
	}

	async updateTask(taskId, updateData) {
		try {
			const payload = {};

			if (updateData.title) payload.title = updateData.title;
			if (updateData.description) payload.description = updateData.description;
			if (updateData.status) payload.status = updateData.status;

			if (updateData.dueDate) {
				payload.dates = {
					due: new Date(updateData.dueDate).toISOString(),
				};
			}

			if (updateData.assigneeWrikeId) {
				payload.responsibles = [updateData.assigneeWrikeId];
			}

			const response = await this.api.put(`/tasks/${taskId}`, payload);
			return response.data.data[0];
		} catch (error) {
			console.error("Error updating Wrike task:", error);
			throw error;
		}
	}

	async getTask(taskId) {
		try {
			const response = await this.api.get(`/tasks/${taskId}`);
			return response.data.data[0];
		} catch (error) {
			console.error("Error fetching Wrike task:", error);
			throw error;
		}
	}

	async getWrikeUsers() {
		try {
			const response = await this.api.get("/contacts");
			return response.data.data;
		} catch (error) {
			console.error("Error fetching Wrike users:", error);
			throw error;
		}
	}
}

module.exports = new WrikeApiService();
