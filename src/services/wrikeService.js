const axios = require("axios");

class WrikeService {
	constructor() {
		this.apiUrl =
			process.env.WRIKE_API_URL || "https://app-eu.wrike.com/api/v4";
		this.accessToken = process.env.WRIKE_ACCESS_TOKEN;
		this.isConfigured = !!this.accessToken && this.accessToken !== "demo-mode";
		this.accountInfo = null;
	}

	/**
	 * Get Wrike API headers
	 */
	getHeaders() {
		return {
			Authorization: `Bearer ${this.accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		};
	}

	/**
	 * Test and get account information
	 */
	async getAccountInfo() {
		if (this.accountInfo) {
			return this.accountInfo;
		}

		try {
			const response = await axios.get(`${this.apiUrl}/account`, {
				headers: this.getHeaders(),
			});

			this.accountInfo = response.data.data[0];
			return this.accountInfo;
		} catch (error) {
			console.error(
				"Failed to get account info:",
				error.response?.data || error.message
			);
			throw new Error("Failed to authenticate with Wrike API");
		}
	}

	/**
	 * Create a task in Wrike using a simpler approach
	 * @param {Object} taskData - Task information
	 */
	async createTask(taskData) {
		if (!this.isConfigured) {
			// Return mock data for demo mode
			return {
				id: `wrike_${Date.now()}`,
				title: taskData.title,
				status: "Active",
				permalink: `https://www.wrike.com/workspace.htm#path=folder&id=wrike_${Date.now()}`,
				created: new Date().toISOString(),
			};
		}

		try {
			// First verify account access
			await this.getAccountInfo();

			// Try different approaches to create a task
			return await this.createTaskWithFallbacks(taskData);
		} catch (error) {
			console.error("Error creating Wrike task:", error.message);

			// For development, return a mock task instead of failing
			if (process.env.NODE_ENV === "development") {
				console.log("Returning mock task for development");
				return {
					id: `mock_${Date.now()}`,
					title: taskData.title,
					status: "Active",
					permalink: `https://www.wrike.com/workspace.htm#mock`,
					created: new Date().toISOString(),
					mock: true,
				};
			}

			throw error;
		}
	}

	/**
	 * Try multiple approaches to create a task
	 */
	async createTaskWithFallbacks(taskData) {
		const taskPayload = {
			title: taskData.title,
			description: taskData.description || "",
			status: "Active",
			importance: "Normal",
		};

		// Approach 1: Try to get spaces and create in the first available space
		try {
			const spacesResponse = await axios.get(`${this.apiUrl}/spaces`, {
				headers: this.getHeaders(),
			});

			if (spacesResponse.data.data && spacesResponse.data.data.length > 0) {
				const firstSpace = spacesResponse.data.data[0];
				console.log(`Creating task in space: ${firstSpace.title}`);

				const response = await axios.post(
					`${this.apiUrl}/folders/${firstSpace.id}/tasks`,
					taskPayload,
					{ headers: this.getHeaders() }
				);

				const task = response.data.data[0];
				return {
					id: task.id,
					title: task.title,
					status: task.status,
					permalink: task.permalink,
					created: task.createdDate,
				};
			}
		} catch (spaceError) {
			console.log(
				"Space approach failed:",
				spaceError.response?.data || spaceError.message
			);
		}

		// Approach 2: Try to create in account root using contacts
		try {
			const contactsResponse = await axios.get(`${this.apiUrl}/contacts`, {
				headers: this.getHeaders(),
			});

			if (contactsResponse.data.data && contactsResponse.data.data.length > 0) {
				// Find current user
				const currentUser = contactsResponse.data.data.find(
					(contact) => contact.profiles && contact.profiles.length > 0
				);

				if (currentUser) {
					const response = await axios.post(
						`${this.apiUrl}/tasks`,
						{
							...taskPayload,
							responsibles: [currentUser.id],
						},
						{ headers: this.getHeaders() }
					);

					const task = response.data.data[0];
					return {
						id: task.id,
						title: task.title,
						status: task.status,
						permalink: task.permalink,
						created: task.createdDate,
					};
				}
			}
		} catch (contactError) {
			console.log(
				"Contact approach failed:",
				contactError.response?.data || contactError.message
			);
		}

		// Approach 3: Simple task creation
		try {
			const response = await axios.post(`${this.apiUrl}/tasks`, taskPayload, {
				headers: this.getHeaders(),
			});

			const task = response.data.data[0];
			return {
				id: task.id,
				title: task.title,
				status: task.status,
				permalink: task.permalink,
				created: task.createdDate,
			};
		} catch (simpleError) {
			console.log(
				"Simple approach failed:",
				simpleError.response?.data || simpleError.message
			);
		}

		throw new Error(
			"All task creation approaches failed. Please check your Wrike permissions."
		);
	}

	/**
	 * Get tasks from Wrike
	 * @param {string} userId - User ID for filtering (optional)
	 */
	async getTasks(userId = null) {
		if (!this.isConfigured) {
			// Return mock data for demo mode
			return [
				{
					id: "wrike_1",
					title: "Review project proposal",
					status: "Active",
					permalink:
						"https://www.wrike.com/workspace.htm#path=folder&id=wrike_1",
					created: "2025-01-17T10:00:00Z",
				},
			];
		}

		try {
			await this.getAccountInfo();

			const response = await axios.get(`${this.apiUrl}/tasks`, {
				headers: this.getHeaders(),
				params: {
					limit: 100,
					sortField: "CreatedDate",
					sortOrder: "Desc",
				},
			});

			return response.data.data.map((task) => ({
				id: task.id,
				title: task.title,
				status: task.status,
				permalink: task.permalink,
				created: task.createdDate,
			}));
		} catch (error) {
			console.error(
				"Error fetching Wrike tasks:",
				error.response?.data || error.message
			);

			// Return empty array instead of throwing for development
			if (process.env.NODE_ENV === "development") {
				return [];
			}

			throw new Error(`Failed to fetch tasks from Wrike: ${error.message}`);
		}
	}

	/**
	 * Update a task in Wrike
	 * @param {string} taskId - Task ID
	 * @param {Object} updates - Updates to apply
	 */
	async updateTask(taskId, updates) {
		if (!this.isConfigured) {
			// Return mock data for demo mode
			return {
				id: taskId,
				title: updates.title || "Updated Task",
				status: updates.status || "Active",
				permalink: `https://www.wrike.com/workspace.htm#path=folder&id=${taskId}`,
				updated: new Date().toISOString(),
			};
		}

		try {
			await this.getAccountInfo();

			const response = await axios.put(
				`${this.apiUrl}/tasks/${taskId}`,
				updates,
				{ headers: this.getHeaders() }
			);

			const task = response.data.data[0];
			return {
				id: task.id,
				title: task.title,
				status: task.status,
				permalink: task.permalink,
				updated: task.updatedDate,
			};
		} catch (error) {
			console.error(
				"Error updating Wrike task:",
				error.response?.data || error.message
			);

			// Return mock update for development
			if (process.env.NODE_ENV === "development") {
				return {
					id: taskId,
					title: updates.title || "Mock Updated Task",
					status: updates.status || "Active",
					mock: true,
				};
			}

			throw new Error(`Failed to update task in Wrike: ${error.message}`);
		}
	}

	/**
	 * Test the Wrike connection
	 */
	async testConnection() {
		try {
			const accountInfo = await this.getAccountInfo();
			console.log("✅ Wrike connection successful:", accountInfo.name);
			return true;
		} catch (error) {
			console.error("❌ Wrike connection failed:", error.message);
			return false;
		}
	}
}

module.exports = new WrikeService();
