const { app } = require("@azure/functions");
const { verifySlackSignature } = require("../utils/slackVerification");
const wrikeService = require("../services/wrikeService");
const databaseService = require("../services/databaseService");

app.http("SlackSlashCommands", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "slack/commands",
	handler: async (request, context) => {
		try {
			context.log("SlackSlashCommands function triggered");

			const rawBody = await request.text();

			// Verify Slack signature if not in demo/development mode
			const signingSecret = process.env.SLACK_SIGNING_SECRET;
			const isDevelopment = process.env.NODE_ENV === "development";

			if (signingSecret && signingSecret !== "demo-mode" && !isDevelopment) {
				const signature = request.headers.get("x-slack-signature");
				const timestamp = request.headers.get("x-slack-request-timestamp");

				if (!signature || !timestamp) {
					context.warn("Missing Slack signature headers");
					return { status: 401, body: "Unauthorized - Missing signature" };
				}

				if (
					!verifySlackSignature(rawBody, signature, timestamp, signingSecret)
				) {
					context.warn("Invalid Slack signature");
					return { status: 401, body: "Unauthorized - Invalid signature" };
				}
			} else if (isDevelopment) {
				context.log("Development mode - skipping signature verification");
			}

			// Parse form data from Slack
			const params = new URLSearchParams(rawBody);
			const command = {
				token: params.get("token"),
				team_id: params.get("team_id"),
				team_domain: params.get("team_domain"),
				channel_id: params.get("channel_id"),
				channel_name: params.get("channel_name"),
				user_id: params.get("user_id"),
				user_name: params.get("user_name"),
				command: params.get("command"),
				text: params.get("text"),
				response_url: params.get("response_url"),
				trigger_id: params.get("trigger_id"),
			};

			context.log(
				"Received slash command:",
				command.command,
				"with text:",
				command.text
			);

			// Route to appropriate command handler
			switch (command.command) {
				case "/task":
					return await handleTaskCommand(command, context);
				case "/wrike":
					return await handleWrikeCommand(command, context);
				case "/help":
					return await handleHelpCommand(command, context);
				default:
					return {
						status: 200,
						jsonBody: {
							response_type: "ephemeral",
							text: `Unknown command: ${command.command}`,
						},
					};
			}
		} catch (error) {
			context.error("SlackSlashCommands error:", error);
			return {
				status: 500,
				jsonBody: {
					response_type: "ephemeral",
					text: "Sorry, something went wrong processing your command.",
				},
			};
		}
	},
});

async function handleTaskCommand(command, context) {
	const text = command.text?.trim();

	if (!text) {
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: "Usage: `/task [create|list|update] [task details]`",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: "*Task Command Help* 📋\n\n• `/task create [title]` - Create a new task\n• `/task list` - List your tasks\n• `/task update [id] [status]` - Update task status",
						},
					},
				],
			},
		};
	}

	const [action, ...args] = text.split(" ");

	switch (action.toLowerCase()) {
		case "create":
			return await createTask(args.join(" "), command, context);
		case "list":
			return await listTasks(command, context);
		case "update":
			return await updateTask(args, command, context);
		default:
			return {
				status: 200,
				jsonBody: {
					response_type: "ephemeral",
					text: `Unknown task action: ${action}. Use \`create\`, \`list\`, or \`update\`.`,
				},
			};
	}
}

async function createTask(title, command, context) {
	if (!title) {
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: "Please provide a task title. Usage: `/task create [title]`",
			},
		};
	}

	try {
		context.log("Creating task:", title);

		let wrikeTask = null;
		let wrikeError = null;

		// Try to create task in Wrike
		try {
			wrikeTask = await wrikeService.createTask({
				title: title,
				description: `Created from Slack by ${command.user_name} in #${command.channel_name}`,
			});
			context.log("Wrike task created successfully:", wrikeTask.id);
		} catch (error) {
			wrikeError = error.message;
			context.warn("Wrike task creation failed:", error.message);

			// Create a mock Wrike task for local storage
			wrikeTask = {
				id: `local_${Date.now()}`,
				title: title,
				status: "Active",
				permalink: null,
				created: new Date().toISOString(),
				mock: true,
			};
		}

		// Save to database (MongoDB or in-memory fallback)
		const task = await databaseService.saveTask({
			id: `task_${Date.now()}`,
			wrike_id: wrikeTask.id,
			title: title,
			status: "Active",
			created_by: command.user_name,
			user_id: command.user_id,
			channel: command.channel_name,
			channel_id: command.channel_id,
			wrike_permalink: wrikeTask.permalink,
			wrike_synced: !wrikeTask.mock,
		});

		// Create response blocks
		const responseBlocks = [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `*New Task Created* 🎯\n*${task.title}*`,
				},
			},
			{
				type: "section",
				fields: [
					{
						type: "mrkdwn",
						text: `*Status:*\n${task.status}`,
					},
					{
						type: "mrkdwn",
						text: `*Created by:*\n<@${command.user_id}>`,
					},
					{
						type: "mrkdwn",
						text: `*Task ID:*\n${task.id}`,
					},
					{
						type: "mrkdwn",
						text: `*Channel:*\n#${task.channel}`,
					},
				],
			},
		];

		// Add action buttons
		const actionElements = [
			{
				type: "button",
				text: {
					type: "plain_text",
					text: "Mark Complete",
				},
				action_id: "complete_task",
				value: task.id,
				style: "primary",
			},
		];

		// Only add Wrike button if successfully synced
		if (task.wrike_permalink && !wrikeTask.mock) {
			actionElements.push({
				type: "button",
				text: {
					type: "plain_text",
					text: "View in Wrike",
				},
				action_id: "view_task",
				value: task.id,
				url: task.wrike_permalink,
			});
		}

		responseBlocks.push({
			type: "actions",
			elements: actionElements,
		});

		// Add warnings for any issues
		const warnings = [];
		if (wrikeError) {
			warnings.push(`⚠️ Wrike sync failed: Task saved locally only`);
		}
		if (task.storage === "memory") {
			warnings.push(`⚠️ Database unavailable: Using temporary storage`);
		}

		if (warnings.length > 0) {
			responseBlocks.push({
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: warnings.join("\n"),
					},
				],
			});
		}

		return {
			status: 200,
			jsonBody: {
				response_type: "in_channel",
				blocks: responseBlocks,
			},
		};
	} catch (error) {
		context.error("Error creating task:", error);
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `❌ Error creating task: ${error.message}`,
			},
		};
	}
}

async function listTasks(command, context) {
	try {
		context.log("Listing tasks for user:", command.user_name);

		// Get tasks from MongoDB
		const tasks = await databaseService.getUserTasks(command.user_name);

		if (tasks.length === 0) {
			return {
				status: 200,
				jsonBody: {
					response_type: "ephemeral",
					text: "You don't have any tasks yet. Use `/task create [title]` to create one!",
				},
			};
		}

		// Get user statistics
		const stats = await databaseService.getUserTaskStats(command.user_name);

		const taskBlocks = tasks.slice(0, 10).map((task) => ({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*${task.title}*\nStatus: ${task.status} | Created: ${new Date(
					task.created_at
				).toLocaleDateString()}`,
			},
			accessory: {
				type: "button",
				text: {
					type: "plain_text",
					text: "Update",
				},
				action_id: "update_task",
				value: task.id,
			},
		}));

		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `*Your Tasks* 📋\nTotal: ${stats.total} | Active: ${stats.active} | Completed: ${stats.completed}`,
						},
					},
					{
						type: "divider",
					},
					...taskBlocks,
					...(tasks.length > 10
						? [
								{
									type: "context",
									elements: [
										{
											type: "mrkdwn",
											text: `Showing 10 of ${tasks.length} tasks. Use filters to see more.`,
										},
									],
								},
						  ]
						: []),
				],
			},
		};
	} catch (error) {
		context.error("Error listing tasks:", error);
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `❌ Error fetching tasks: ${error.message}`,
			},
		};
	}
}

async function updateTask(args, command, context) {
	if (args.length < 2) {
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: "Usage: `/task update [task_id] [status]`\nExample: `/task update task_123 completed`",
			},
		};
	}

	try {
		const [taskId, status] = args;
		context.log("Updating task:", taskId, "to status:", status);

		// Update in MongoDB
		const updatedTask = await databaseService.updateTask(taskId, {
			status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
		});

		// Update in Wrike if configured
		if (updatedTask.wrike_id) {
			try {
				await wrikeService.updateTask(updatedTask.wrike_id, { status });
			} catch (error) {
				context.warn("Failed to update task in Wrike:", error.message);
			}
		}

		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `✅ Task "${updatedTask.title}" updated to status: ${updatedTask.status}`,
			},
		};
	} catch (error) {
		context.error("Error updating task:", error);
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `❌ Error updating task: ${error.message}`,
			},
		};
	}
}

async function handleWrikeCommand(command, context) {
	return {
		status: 200,
		jsonBody: {
			response_type: "ephemeral",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "*Wrike Integration* 🔗\n\nConnect with your Wrike workspace to sync tasks and projects.",
					},
				},
				{
					type: "actions",
					elements: [
						{
							type: "button",
							text: {
								type: "plain_text",
								text: "Open Wrike Dashboard",
							},
							url: "https://www.wrike.com/workspace.htm",
							action_id: "open_wrike",
						},
					],
				},
			],
		},
	};
}

async function handleHelpCommand(command, context) {
	return {
		status: 200,
		jsonBody: {
			response_type: "ephemeral",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "*Available Commands* 🛠️",
					},
				},
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "*Task Commands:*\n• `/task create [title]` - Create a new task\n• `/task list` - List your tasks\n• `/task update [id] [status]` - Update task status",
					},
				},
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "*Wrike Commands:*\n• `/wrike` - Open Wrike integration panel",
					},
				},
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "*General:*\n• `/help` - Show this help message",
					},
				},
			],
		},
	};
}
