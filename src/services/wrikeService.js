const axios = require("axios");
const { WRIKE_CONFIG, CHANNEL_TO_WRIKE_PROJECT } = require("../utils/config");
const { DatabaseService } = require("./databaseService");

class WrikeService {
	constructor() {
		this.client = axios.create({
			baseURL: WRIKE_CONFIG.API_BASE_URL,
			headers: {
				Authorization: `Bearer ${WRIKE_CONFIG.ACCESS_TOKEN}`,
				"Content-Type": "application/json",
			},
			timeout: WRIKE_CONFIG.TIMEOUT,
		});
		this.databaseService = new DatabaseService();
	}
	// Add this method to your WrikeService class
	// ...existing code...
	// Fix the listFolders method - replace the current implementation
	async listFolders() {
		try {
			// Use this.client instead of this.apiClient
			const response = await this.client.get("/folders");
			return response;
		} catch (error) {
			// Enhanced error handling following Azure Functions best practices
			const errorDetails = {
				message: error.message,
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
			};

			if (error.response?.status === 401) {
				throw new Error(
					`Authentication failed when listing folders: Invalid Wrike access token`
				);
			} else if (error.response?.status === 403) {
				throw new Error(
					`Permission denied when listing folders: Insufficient permissions`
				);
			} else if (error.response?.status >= 500) {
				throw new Error(
					`Wrike server error when listing folders: ${error.response?.statusText}`
				);
			}

			throw new Error(`Failed to list folders: ${error.message}`);
		}
	}
	// ...existing code...
	async createTask(taskDetails, channelId) {
		await this.testConnection();
		// Map channel ID to Wrike folder ID, fallback to default
		const folderId =
			CHANNEL_TO_WRIKE_PROJECT[channelId] || WRIKE_CONFIG.DEFAULT_FOLDER_ID;
		console.log(`Creating task in folder: ${folderId}`);
		console.log(`channelId: ${channelId}`);

		const payload = this.buildTaskPayload(taskDetails);

		const response = await this.client.post(
			`/folders/${folderId}/tasks`,
			payload
		);
		const task = response.data.data[0];
		const taskId = new URL(task.permalink).searchParams.get("id");

		if (taskDetails.startDate && taskDetails.dueDate) {
			await this.setTaskDate(
				task.id,
				taskDetails.startDate,
				taskDetails.dueDate
			);
		}

		this.databaseService.saveTaskAsync({
			...taskDetails,
			wrikeTaskId: taskId,
			wrikePermalink: task.permalink,
			wrikeFolderId: folderId,
		});

		return { taskId, taskUrl: task.permalink };
	}

	// Add this new method to resolve display ID to API task ID
	async resolveTaskId(displayTaskId) {
		try {
			// Search for the task using the display ID
			const response = await this.client.get(`/tasks`, {
				params: {
					permalink: `https://www.wrike.com/open.htm?id=${displayTaskId}`,
				},
			});

			if (response.data.data && response.data.data.length > 0) {
				const actualTaskId = response.data.data[0].id;
				console.log("Resolved task ID:", {
					displayTaskId,
					actualTaskId,
				});
				return actualTaskId;
			}

			// If not found by permalink, try searching by custom field or title
			const searchResponse = await this.client.get(`/tasks`, {
				params: {
					fields: JSON.stringify(["customFields"]),
					limit: 100,
				},
			});

			// Look for a task that has the display ID in its custom fields or matches somehow
			const matchingTask = searchResponse.data.data.find((task) => {
				const taskDisplayId = new URL(task.permalink).searchParams.get("id");
				return taskDisplayId === displayTaskId;
			});

			if (matchingTask) {
				console.log("Found task by permalink search:", {
					displayTaskId,
					actualTaskId: matchingTask.id,
				});
				return matchingTask.id;
			}

			throw new Error(`Task not found for display ID: ${displayTaskId}`);
		} catch (error) {
			console.error("Failed to resolve task ID:", {
				displayTaskId,
				error: error.response?.data || error.message,
				statusCode: error.response?.status,
			});
			throw new Error(
				`Could not resolve task ID ${displayTaskId}: ${error.message}`
			);
		}
	}
	

	// Update the updateTaskStatus method to resolve the ID first
	// Updated updateTaskStatus method with your actual custom status IDs
	async updateTaskStatus(taskId, status) {
    try {
        // Validate inputs
        if (!taskId || typeof taskId !== "string") {
            throw new Error(`Invalid task ID provided: ${taskId}`);
        }

        if (!status || typeof status !== "string") {
            throw new Error(`Invalid status provided: ${status}`);
        }

        // Resolve display ID to actual API task ID
        const actualTaskId = await this.resolveTaskId(taskId);

        // Map your status names to actual Wrike custom status IDs from your workspace
        const customStatusMapping = {
            New: "IEABCJBLJMAAAAAA",
            InProgress: "IEABCJBLJME36BF2",
            Completed: "IEABCJBLJMAAAAAB",
            OnHold: "IEABCJBLJMAAAAAC",
            Cancelled: "IEABCJBLJMAAAAAD",
        };

        // Get the custom status ID if available
        const customStatusId = customStatusMapping[status];

        console.log("Updating Wrike task:", {
            displayTaskId: taskId,
            actualTaskId,
            originalStatus: status,
            customStatusId,
            hasCustomStatus: !!customStatusId,
            endpoint: `/tasks/${actualTaskId}`,
        });

        let payload;
        let updateStrategy;

        if (customStatusId) {
            // Use custom status only (don't set main status)
            payload = {
                customStatus: customStatusId,
            };
            updateStrategy = "customStatus";
        } else {
            // Use main status for statuses without custom status mapping
            const wrikeStatus = {
                Planned: "Active",
                InReview: "Active",
            }[status] || "Active";
            
            payload = {
                status: wrikeStatus,
            };
            updateStrategy = "mainStatus";
        }

        console.log("Using update strategy:", {
            strategy: updateStrategy,
            payload,
        });

        const response = await this.client.put(`/tasks/${actualTaskId}`, payload);

        console.log("Wrike update response:", {
            displayTaskId: taskId,
            actualTaskId,
            strategy: updateStrategy,
            status: response.status,
            data: response.data,
        });

        return response.data;
    } catch (error) {
        // Enhanced error logging following Azure Functions best practices
        console.error("Wrike API update failed:", {
            taskId,
            status,
            error: error.response?.data || error.message,
            statusCode: error.response?.status,
            url: error.config?.url,
        });
        throw error;
    }
}

	async testConnection() {
		try {
			await this.client.get("/account");
		} catch (error) {
			throw new Error(
				error.response?.status === 401
					? "Invalid Wrike access token"
					: `Wrike connection failed: ${error.message}`
			);
		}
	}

	async setTaskDate(taskId, startDate, dueDate) {
		const payload = {
			dates: { type: "Planned", start: startDate, due: dueDate },
		};
		await this.client.put(`/tasks/${taskId}`, payload);
	}

	buildTaskPayload(taskDetails) {
		const payload = {
			title: taskDetails.title,
			description: taskDetails.description || "",
		};
		if (taskDetails.assignee || taskDetails.description) {
			payload.customFields = [];
			if (taskDetails.assignee)
				payload.customFields.push({
					id: WRIKE_CONFIG.CUSTOM_FIELDS.ASSIGNEE,
					value: taskDetails.assignee,
				});
			if (taskDetails.description)
				payload.customFields.push({
					id: WRIKE_CONFIG.CUSTOM_FIELDS.DESCRIPTION,
					value: taskDetails.description,
				});
		}
		return payload;
	}
}

module.exports = { WrikeService };
