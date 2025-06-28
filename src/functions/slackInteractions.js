const { app } = require("@azure/functions");
const { createTaskModal } = require("../utils/modalBuilder");
const { SlackService } = require("../services/slackService");
const { WrikeService } = require("../services/wrikeService");
const { DatabaseService } = require("../services/databaseService");
const { ResponseBuilder } = require("../utils/responseBuilder");

const slackService = new SlackService();
const wrikeService = new WrikeService();
const databaseService = new DatabaseService();

app.http("SlackInteractions", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "slack/interactions",
	handler: async (request, context) => {
		context.log("SlackInteractions triggered", {
			correlationId: context.invocationId,
			timestamp: new Date().toISOString(),
		});

		try {
			// Parse URL-encoded form data
			const rawBody = await request.text();
			const params = new URLSearchParams(rawBody);
			const payloadString = params.get("payload");

			if (!payloadString) {
				context.error("No payload found in request", {
					correlationId: context.invocationId,
				});
				return ResponseBuilder.ephemeralError(
					"Invalid request: No payload provided"
				);
			}

			let payload;
			try {
				payload = JSON.parse(payloadString);
			} catch (error) {
				context.error("Failed to parse payload:", {
					error: error.message,
					correlationId: context.invocationId,
				});
				return ResponseBuilder.ephemeralError("Invalid payload format");
			}

			// Handle view submission (task creation)
			if (
				payload.type === "view_submission" &&
				payload.view.callback_id === "create_task_modal"
			) {
				try {
					const taskDetails = await extractTaskDetails(
						payload.view.state.values
					);
					console.log("Extracted task details:", taskDetails);
					const channelId = payload.view.private_metadata;

					context.log("Processing task creation:", {
						channelId,
						userId: payload.user.id,
						correlationId: context.invocationId,
					});

					const result = await handleTaskCreation(
						taskDetails,
						payload.user.id,
						channelId,
						context
					);

					// Return appropriate response based on result
					if (result && result.success === false) {
						return result;
					}

					return ResponseBuilder.success();
				} catch (error) {
					context.error("Task creation workflow failed:", {
						error: error.message,
						stack: error.stack,
						correlationId: context.invocationId,
					});
					return ResponseBuilder.ephemeralError(
						`Task creation failed: ${error.message}`
					);
				}
			}

			// Handle block actions
			if (payload.type === "block_actions") {
				const action = payload.actions[0];
				context.log("Received block action:", {
					actionId: action.action_id,
					correlationId: context.invocationId,
				});

				const channelId =
					payload.channel?.id ||
					payload.message?.channel.id ||
					payload.view?.private_metadata;

				if (action.action_id === "create_another_task") {
					return await openTaskModal(payload.trigger_id, channelId, context);
				}

				if (action.action_id === "update_task_status") {
					const actionValue = action.selected_option.value;
					const [taskId, newStatus] = actionValue.split(":");

					// Enhanced validation
					if (
						!taskId ||
						!newStatus ||
						taskId.trim() === "" ||
						newStatus.trim() === ""
					) {
						context.error("Invalid action value format:", {
							actionValue,
							taskId,
							newStatus,
							correlationId: context.invocationId,
						});
						return ResponseBuilder.ephemeralError(
							"Invalid task update request"
						);
					}

					return await updateTaskStatus(taskId, newStatus, context);
				}
			}

			return ResponseBuilder.ephemeralError("Interaction not supported");
		} catch (error) {
			context.error("Unhandled error in SlackInteractions:", {
				error: error.message,
				stack: error.stack,
				correlationId: context.invocationId,
			});
			return ResponseBuilder.ephemeralError("Internal server error");
		}
	},
});

async function openTaskModal(triggerId, channelId, context) {
	try {
		await slackService.openModal(triggerId, createTaskModal(channelId));
		context.log("Modal opened successfully", {
			channelId,
			correlationId: context.invocationId,
		});
		return ResponseBuilder.success();
	} catch (error) {
		context.error("Error opening modal:", {
			error: error.message,
			channelId,
			correlationId: context.invocationId,
		});
		return error.message === "EXPIRED_TRIGGER_ID"
			? ResponseBuilder.expiredTriggerResponse()
			: ResponseBuilder.ephemeralError(
					`Failed to open modal: ${error.message}`
			  );
	}
}

async function debugListFolders(context) {
	try {
		if (typeof wrikeService.listFolders !== "function") {
			context.warn("listFolders method not implemented in WrikeService");
			return;
		}

		context.log("Attempting to list Wrike folders...");
		const response = await wrikeService.listFolders();

		if (response.data && response.data.data) {
			const folders = response.data.data.map((folder) => ({
				id: folder.id,
				title: folder.title,
				scope: folder.scope,
			}));

			context.log("Available folders:", {
				count: folders.length,
				folders: folders,
				correlationId: context.invocationId,
			});
		} else {
			context.log("Available folders response:", {
				response: JSON.stringify(response.data, null, 2),
				correlationId: context.invocationId,
			});
		}
	} catch (error) {
		context.error("Failed to list folders:", {
			error: {
				message: error.message,
				stack: error.stack,
				name: error.name,
			},
			apiError: error.response
				? {
						status: error.response.status,
						statusText: error.response.statusText,
						data: error.response.data,
				  }
				: null,
			correlationId: context.invocationId,
		});
	}
}

async function handleTaskCreation(taskDetails, userId, channelId, context) {
	try {
		// Debug Wrike folders (non-blocking)
		debugListFolders(context);

		// Create task in Wrike
		const task = await wrikeService.createTask(taskDetails, channelId);

		context.log("Wrike task created:", {
			taskId: task.taskId,
			taskUrl: task.taskUrl,
			correlationId: context.invocationId,
		});

		// Send notifications and get message info
		const notificationPromises = [
			slackService
				.notifyChannel(channelId,taskDetails, task.taskId, task.taskUrl, context)
				.catch((error) => {
					context.warn("Channel notification failed:", error.message);
					return null;
				}),
			// slackService.notifyUser(
			//     userId,
			//     taskDetails,
			//     task.taskId,
			//     task.taskUrl,
			//     context
			// ).catch(error => {
			//     context.warn("User notification failed:", error.message);
			//     return null;
			// })
		];
		console.log("taskDetails.assigneeUserId:", taskDetails.assigneeUserId);
		console.log("taskDetails:", taskDetails);
		// Add assignee notification if there's an assignee and it's different from the creator
		// if (taskDetails.assigneeUserId && taskDetails.assigneeUserId !== userId) {
		if (taskDetails.assigneeUserId) {
			notificationPromises.push(
				slackService
					.notifyAssignee(
						taskDetails.assigneeUserId,
						taskDetails,
						task.taskId,
						task.taskUrl,
						context
					)
					.catch((error) => {
						context.warn("Assignee notification failed:", error.message);
						return null;
					})
			);
		}

		const [channelMessageInfo, userMessageInfo, assigneeMessageInfo] =
			await Promise.all(notificationPromises);

		// Save task to database
		try {
			const taskData = {
				...taskDetails,
				wrikeTaskId: task.taskId,
				wrikePermalink: task.taskUrl,
				wrikeFolderId: channelId,
				status: "New",
				channelMessageInfo,
				userMessageInfo,
				assigneeMessageInfo,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const savedTask = await databaseService.saveTask(taskData);

			context.log("Task saved to database:", {
				taskId: task.taskId,
				savedTaskId: savedTask,
				correlationId: context.invocationId,
			});
		} catch (dbError) {
			context.error("Database save failed:", {
				error: dbError.message,
				taskId: task.taskId,
				correlationId: context.invocationId,
			});
		}

		context.log("Task creation completed successfully:", {
			taskId: task.taskId,
			channelId,
			userId,
			assigneeUserId: taskDetails.assigneeUserId,
			correlationId: context.invocationId,
		});

		return { success: true };
	} catch (error) {
		context.error("Task creation failed:", {
			error: {
				message: error.message,
				stack: error.stack,
				name: error.name,
			},
			httpError: error.response
				? {
						status: error.response.status,
						statusText: error.response.statusText,
						data: error.response.data,
				  }
				: null,
			config: error.config
				? {
						url: error.config.url,
						method: error.config.method,
				  }
				: null,
			correlationId: context.invocationId,
		});

		const errorMessage =
			error.response?.data?.error_description ||
			error.response?.data?.message ||
			error.message ||
			"Unknown error occurred";

		return ResponseBuilder.ephemeralError(
			`Task creation failed: ${errorMessage}`
		);
	}
}

async function updateTaskStatus(taskId, status, context) {
	try {
		// Validate inputs
		if (!taskId || typeof taskId !== "string") {
			throw new Error(`Invalid task ID provided: ${taskId}`);
		}

		if (!status || typeof status !== "string") {
			throw new Error(`Invalid status provided: ${status}`);
		}

		context.log("Updating Wrike task:", {
			taskId,
			newStatus: status,
			correlationId: context.invocationId,
		});

		// Update status in Wrike
		const response = await wrikeService.updateTaskStatus(taskId, status);

		// Get task details from database for notifications
		let taskData = null;
		try {
			taskData = await databaseService.getTask(taskId);
		} catch (dbError) {
			context.warn("Failed to get task from database:", {
				error: dbError.message,
				taskId,
				correlationId: context.invocationId,
			});
		}

		if (taskData) {
			const oldStatus = taskData.status || "New";

			// Send status update notifications
			try {
				console.log("taskData", taskData);
				await slackService.notifyStatusUpdate(
					taskData,
					taskId,
					taskData.wrikePermalink,
					oldStatus,
					status,
					context
				);

				// Update original messages
				if (taskData.channelMessageInfo) {
					await slackService
						.updateTaskMessage(
							taskData.channelMessageInfo,
							taskData,
							taskId,
							taskData.wrikePermalink,
							status,
							context
						)
						.catch((error) => {
							context.warn("Failed to update channel message:", error.message);
						});
				}

				if (taskData.userMessageInfo) {
					await slackService
						.updateTaskMessage(
							taskData.userMessageInfo,
							taskData,
							taskId,
							taskData.wrikePermalink,
							status,
							context
						)
						.catch((error) => {
							context.warn("Failed to update user message:", error.message);
						});
				}

				// Update status in database
				await databaseService.updateTaskStatus(taskId, status);
			} catch (notificationError) {
				context.warn("Notification or message update failed:", {
					error: notificationError.message,
					taskId,
					correlationId: context.invocationId,
				});
			}
		}

		context.log("Task status update completed:", {
			taskId,
			newStatus: status,
			wrikeResponse: response?.status,
			correlationId: context.invocationId,
		});

		return ResponseBuilder.success();
	} catch (error) {
		context.error("Task status update failed:", {
			taskId,
			status,
			error: {
				message: error.message,
				stack: error.stack,
			},
			httpError: error.response
				? {
						status: error.response.status,
						data: error.response.data,
				  }
				: null,
			correlationId: context.invocationId,
		});

		return ResponseBuilder.ephemeralError(
			`Failed to update task status: ${error.message}`
		);
	}
}

async function extractTaskDetails(values) {
	const assigneeUserId = values.task_assignee?.assignee_input?.selected_user;

	// Get user display name if assignee is selected
	let assigneeDisplayName = null;
	if (assigneeUserId) {
		try {
			assigneeDisplayName = await slackService.getUserDisplayName(
				assigneeUserId
			);
			console.log("Assignee display name retrieved:", assigneeDisplayName);
		} catch (error) {
			console.warn("Failed to get user display name:", error.message);
			assigneeDisplayName = assigneeUserId; // Fallback to user ID
		}
	}

	return {
		title: values.task_title?.title_input?.value || "Untitled Task",
		description: values.task_description?.description_input?.value || "",
		startDate: values.task_start_date?.start_date_input?.selected_date || null,
		dueDate: values.task_due_date?.due_date_input?.selected_date || null,
		assignee: assigneeDisplayName,
		assigneeUserId: assigneeUserId,
	};
}
