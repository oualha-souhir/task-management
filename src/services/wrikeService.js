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
		try {
			await this.testConnection();
			
			// Map channel ID to Wrike folder ID, fallback to default
			const folderId = CHANNEL_TO_WRIKE_PROJECT[channelId] || WRIKE_CONFIG.DEFAULT_FOLDER_ID;
			
			console.log(`Creating task in folder: ${folderId}`);
			console.log(`channelId: ${channelId}`);

			const payload = this.buildTaskPayload(taskDetails);

			const response = await this.client.post(`/folders/${folderId}/tasks`, payload);
			const task = response.data.data[0];
			const taskId = new URL(task.permalink).searchParams.get("id");

			if (taskDetails.startDate && taskDetails.dueDate) {
				await this.setTaskDate(task.id, taskDetails.startDate, taskDetails.dueDate);
			}

			// Enhanced database save with channelId and status
			const taskDataForDb = {
				...taskDetails,
				wrikeTaskId: taskId,
				wrikePermalink: task.permalink,
				wrikeFolderId: folderId,
				channelId: channelId, // Explicitly include channelId
				status: 'New', // Initial status
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			console.log("Saving task to database with enhanced data:", {
				taskId,
				channelId,
				status: 'New',
				folderId
			});

			// Use async database save for better performance
			await this.databaseService.saveTaskAsync(taskDataForDb);

			return { taskId, taskUrl: task.permalink };
			
		} catch (error) {
			console.error("Task creation failed:", {
				error: error.message,
				channelId,
				stack: error.stack
			});
			throw error;
		}
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

        // Get current task data from database first
        let currentTaskData = null;
        try {
            currentTaskData = await this.databaseService.getTask(taskId);
            console.log("Retrieved current task data:", {
                taskId,
                hasData: !!currentTaskData,
                currentStatus: currentTaskData?.status,
                channelId: currentTaskData?.channelId
            });
        } catch (dbError) {
            console.warn("Failed to get current task data from database:", {
                taskId,
                error: dbError.message
            });
            // Continue without current data - we'll update what we can
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
            currentChannelId: currentTaskData?.channelId,
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

        // Update task in Wrike
        const response = await this.client.put(`/tasks/${actualTaskId}`, payload);

        console.log("Wrike update successful:", {
            displayTaskId: taskId,
            actualTaskId,
            strategy: updateStrategy,
            status: response.status
        });

        // Update status in database
        try {
            const updateData = {
                status: status,
                updatedAt: new Date().toISOString(),
                previousStatus: currentTaskData?.status || 'Unknown'
            };

            // Include channelId if available from current data
            if (currentTaskData?.channelId) {
                updateData.channelId = currentTaskData.channelId;
            }

            await this.databaseService.updateTaskStatus(taskId, updateData);
            
            console.log("Database status updated successfully:", {
                taskId,
                newStatus: status,
                channelId: currentTaskData?.channelId,
                previousStatus: currentTaskData?.status
            });

        } catch (dbError) {
            console.error("Failed to update status in database:", {
                taskId,
                status,
                error: dbError.message,
                channelId: currentTaskData?.channelId
            });
            // Don't throw here - Wrike update succeeded, database update failed
            // This follows Azure Functions best practices for partial failures
        }

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
            correlationId: process.env.INVOCATION_ID // Azure Functions correlation ID
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
