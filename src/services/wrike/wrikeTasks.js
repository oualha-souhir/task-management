const WrikeClient = require("./wrikeClient");
const WRIKE_CONFIG = require("./wrikeConfig");
const WrikeConnection = require("./wrikeConnection");
const databaseService = require("../databaseService");
const healthCheck = require("../../utils/connectionHealthCheck");

class WrikeTasks {
	constructor() {
		this.client = new WrikeClient();
		this.connection = new WrikeConnection();
	}

	buildTaskPayload(taskDetails) {
		let taskPayload = {
			title: taskDetails.title,
			description: taskDetails.description || "",
		};

		if (taskDetails.assignee || taskDetails.description) {
			taskPayload.customFields = [];

			if (taskDetails.assignee) {
				taskPayload.customFields.push({
					id: WRIKE_CONFIG.CUSTOM_FIELDS.ASSIGNEE,
					value: taskDetails.assignee,
				});
			}

			if (taskDetails.description) {
				taskPayload.customFields.push({
					id: WRIKE_CONFIG.CUSTOM_FIELDS.DESCRIPTION,
					value: taskDetails.description,
				});
			}
		}

		return taskPayload;
	}

	async setTaskDate(taskId, startDate, dueDate) {
    try {
        console.log("Adding due date to task...");
        const formatDateForWrike = (dateString) => {
            if (dateString && typeof dateString === "string") {
                if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return dateString; // Send YYYY-MM-DD directly
                }
                return dateString;
            }
            return dateString;
        };

        const datePayload = {
            dates: {
                type: "Planned",
                start: startDate ? formatDateForWrike(startDate) : undefined,
                due: dueDate ? formatDateForWrike(dueDate) : undefined
            }
        };

        // Remove undefined fields to avoid sending invalid data
        if (!datePayload.dates.start) delete datePayload.dates.start;
        if (!datePayload.dates.due) delete datePayload.dates.due;

        console.log("Date payload:", JSON.stringify(datePayload, null, 2));
        await this.client.put(`/tasks/${taskId}`, datePayload);
        console.log("Task updated with due date successfully");
    } catch (dateError) {
        console.warn("Failed to set due date:", dateError.message);
        if (dateError.response) {
            console.warn("Error details:", {
                status: dateError.response.status,
                data: dateError.response.data
            });
        }
        // Notify the user via Slack about the partial failure
        await this.notifySlackOfPartialFailure(taskDetails, taskPermalink);
    }
}
	async createTaskInFolder(taskDetails, folderId) {
		console.log(
			`Creating task in folder ${folderId} with details:`,
			taskDetails
		);

		try {
			// Verify folder access
			console.log("Verifying folder access...");
			await this.client.get(`/folders/${folderId}`);

			// Create task payload
			const taskPayload = this.buildTaskPayload(taskDetails);
			console.log(
				"Creating task with payload:",
				JSON.stringify(taskPayload, null, 2)
			);

			const response = await this.client.post(
				`/folders/${folderId}/tasks`,
				taskPayload
			);

			console.log("Task created successfully");
			// const taskId = response.data.data[0].id;
			const taskPermalink = response.data.data[0].permalink;
			const url = new URL(taskPermalink);
			const taskId = url.searchParams.get("id");
			console.log(`Task created with ID: ${taskId}`);
			console.log(`View task at: ${taskPermalink}`);
			console.log("taskDetails.startDate:", taskDetails.startDate);
			console.log("taskDetails.dueDate:", taskDetails.dueDate);
			console.log("taskDetails:", taskDetails);

			// If there's a due date, update the task with dates
			if (taskDetails.dueDate && taskDetails.startDate) {
				await this.setTaskDate(
					response.data.data[0].id,
					taskDetails.startDate,
					taskDetails.dueDate
				);
			}

			// Check database health before attempting save
			const dbHealth = await healthCheck.checkHealth();
			if (!dbHealth.healthy) {
				console.warn("⚠️ Database health check failed, skipping database save");
				console.warn(healthCheck.getAdvice(dbHealth));
			} else {
				// Save task to database asynchronously (fire-and-forget to prevent Azure Function warnings)
				const taskForDatabase = {
					...taskDetails,
					wrikeTaskId: taskId,
					wrikePermalink: taskPermalink,
					status: taskDetails.status || "Active",
				};

				// Use async save to prevent blocking and context warnings
				databaseService.saveTaskAsync(taskForDatabase);
				console.log("Background database save initiated");
			}

			return {
				...response.data,
				taskUrl: taskPermalink,
				taskId: taskId,
			};
		} catch (error) {
			console.error("Error creating task with folder:", {
				status: error.response?.status,
				message: error.message,
			});

			if (error.response?.status === 401) {
				throw new Error("Wrike access token is invalid or expired");
			}

			if (error.response?.status === 403) {
				throw new Error(
					"Access denied to the specified folder. Please check folder permissions."
				);
			}

			if (error.response) {
				throw new Error(
					`Failed to create task: ${error.response.status} - ${
						error.response.data?.errorDescription ||
						error.response.data?.error ||
						error.response.statusText
					}`
				);
			}
			throw new Error(`Failed to create task: ${error.message}`);
		}
	}

	async createTask(taskDetails) {
		console.log("Creating task in Wrike with details:", taskDetails);

		try {
			// Test connection first
			await this.connection.testConnection();

			// Use the default folder ID
			const folderId = WRIKE_CONFIG.DEFAULT_FOLDER_ID;
			console.log("Using folder ID:", folderId);

			// Create the task and return the result
			return await this.createTaskInFolder(taskDetails, folderId);
		} catch (error) {
			console.error("Error in createTask:", error.message);

			// Provide specific error messages
			if (
				error.message.includes("token is invalid") ||
				error.message.includes("expired")
			) {
				throw new Error(
					"Wrike integration error: Your access token is invalid or expired. Please update your WRIKE_ACCESS_TOKEN environment variable with a valid token."
				);
			}

			if (error.message.includes("not_authorized")) {
				throw new Error(
					"Wrike integration error: Access denied. Please check that your Wrike token has the necessary permissions to create tasks."
				);
			}

			throw new Error(`Failed to create task in Wrike: ${error.message}`);
		}
	}

	async updateTask(taskId, updates) {
		try {
			await this.connection.testConnection();
			const response = await this.client.put(`/tasks/${taskId}`, updates);
			return response.data;
		} catch (error) {
			console.error("Error updating task:", {
				status: error.response?.status,
				message: error.message,
			});

			if (error.response?.status === 401) {
				throw new Error("Wrike access token is invalid or expired");
			}

			throw new Error(`Failed to update task in Wrike: ${error.message}`);
		}
	}
}

module.exports = WrikeTasks;
