const { app } = require("@azure/functions");
const { createTaskModal } = require("../utils/modalBuilder");
const { SlackService } = require("../services/slackService");
const { WrikeService } = require("../services/wrikeService");
const { ResponseBuilder } = require("../utils/responseBuilder");
const { channel } = require("diagnostics_channel");

const slackService = new SlackService();
const wrikeService = new WrikeService();

app.http("SlackInteractions", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "slack/interactions",
	handler: async (request, context) => {
		context.log("SlackInteractions triggered");

		// Parse URL-encoded form data
		const rawBody = await request.text();
		const params = new URLSearchParams(rawBody);
		const payloadString = params.get("payload");

		if (!payloadString) {
			context.error("No payload found in request");
			return ResponseBuilder.ephemeralError(
				"Invalid request: No payload provided"
			);
		}

		let payload;
		try {
			payload = JSON.parse(payloadString);
		} catch (error) {
			context.error("Failed to parse payload:", error.message);
			return ResponseBuilder.ephemeralError("Invalid payload format");
		}

		if (
			payload.type === "view_submission" &&
			payload.view.callback_id === "create_task_modal"
		) {
			const taskDetails = extractTaskDetails(payload.view.state.values);
			console.log(
				"payload.view.private_metadata",
				payload.view.private_metadata
			);
			const channelId = payload.view.private_metadata;
			await handleTaskCreation(
				taskDetails,
				payload.user.id,
				channelId,
				context
			);
			return ResponseBuilder.success();
		}

		if (payload.type === "block_actions") {
			const action = payload.actions[0];
			console.log("Received block action:", action);
			const channelId =
				payload.channel?.id ||
				payload.message?.channel.id ||
				payload.view.private_metadata;
			console.log("Channel ID:", channelId);
			if (action.action_id === "create_another_task") {
				return await openTaskModal(payload.trigger_id, channelId, context);
			}
			if (action.action_id === "update_task_status") {
				const actionValue = action.selected_option.value;
				const [taskId, newStatus] = actionValue.split(":");

				// Enhanced validation following Azure Functions best practices
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
					return ResponseBuilder.ephemeralError("Invalid task update request");
				}

				context.log("Processing task status update:", {
					taskId,
					newStatus,
					actionValue,
					correlationId: context.invocationId,
				});

				return await updateTaskStatus(taskId, newStatus, context);
			}
		}

		return ResponseBuilder.ephemeralError("Interaction not supported");
	},
});

async function openTaskModal(triggerId, channelId, context) {
	try {
		await slackService.openModal(triggerId, createTaskModal(channelId));
		return ResponseBuilder.success();
	} catch (error) {
		context.error("Error opening modal:", error.message);
		return error.message === "EXPIRED_TRIGGER_ID"
			? ResponseBuilder.expiredTriggerResponse()
			: ResponseBuilder.ephemeralError(
					`Failed to open modal: ${error.message}`
			  );
	}
}
async function debugListFolders(context) {
	try {
		// Check if the method exists before calling it
		if (typeof wrikeService.listFolders !== "function") {
			context.warn("listFolders method not implemented in WrikeService");
			return;
		}

		context.log("Attempting to list Wrike folders...");
		const response = await wrikeService.listFolders();

		// Log folder information in a structured way
		if (response.data && response.data.data) {
			const folders = response.data.data.map((folder) => ({
				id: folder.id,
				title: folder.title,
				scope: folder.scope,
			}));

			context.log("Available folders:", {
				count: folders.length,
				folders: folders,
			});
		} else {
			context.log(
				"Available folders response:",
				JSON.stringify(response.data, null, 2)
			);
		}
	} catch (error) {
		// Enhanced error logging following Azure Functions best practices
		const errorContext = {
			functionName: "debugListFolders",
			error: {
				message: error.message,
				stack: error.stack,
				name: error.name,
			},
		};

		// Add API-specific error details if available
		if (error.response) {
			errorContext.apiError = {
				status: error.response.status,
				statusText: error.response.statusText,
				data: error.response.data,
			};
		}

		context.error("Failed to list folders:", errorContext);

		// Don't throw here - this is just for debugging
		// The main task creation process can continue
	}
}
async function handleTaskCreation(taskDetails, userId, channelId, context) {
	try {
		debugListFolders(context); // Debugging: List available folders

		const task = await wrikeService.createTask(taskDetails, channelId);
		await Promise.all([
			slackService.notifyChannel(
				taskDetails,
				task.taskId,
				task.taskUrl,
				context
			),
			slackService.notifyUser(
				userId,
				taskDetails,
				task.taskId,
				task.taskUrl,
				context
			),
		]);
	} catch (error) {
		// Enhanced error logging for better debugging
		context.error("Task creation failed:", {
			message: error.message,
			status: error.response?.status,
			statusText: error.response?.statusText,
			data: error.response?.data,
			config: {
				url: error.config?.url,
				method: error.config?.method,
				data: error.config?.data,
			},
		});

		// Return a more specific error message
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

async function updateTaskStatus(taskId, status) {
	try {
		// Validate inputs
		if (!taskId || typeof taskId !== "string") {
			throw new Error(`Invalid task ID provided: ${taskId}`);
		}

		if (!status || typeof status !== "string") {
			throw new Error(`Invalid status provided: ${status}`);
		}

		const wrikeStatus =
			{
				New: "Active",
				Planned: "Active",
				InProgress: "Active",
				InReview: "Active",
				Completed: "Completed",
			}[status] || "Active";

		console.log("Updating Wrike task:", {
			taskId,
			originalStatus: status,
			wrikeStatus,
			endpoint: `/tasks/${taskId}`,
		});

		// Use wrikeService to update the task status
		const response = await wrikeService.updateTaskStatus(taskId, status);

		console.log("Wrike update response:", {
			taskId,
			status: response.status,
			data: response.data,
		});

		return response.data;
	} catch (error) {
		// Enhanced error logging
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
function extractTaskDetails(values) {
	return {
		title: values.task_title?.title_input?.value || "Untitled Task",
		description: values.task_description?.description_input?.value || "",
		startDate: values.task_start_date?.start_date_input?.selected_date || null,
		dueDate: values.task_due_date?.due_date_input?.selected_date || null,
		assignee: values.task_assignee?.assignee_input?.value || null,
	};
}
