const { app } = require("@azure/functions");
const { verifySlackSignature } = require("../utils/slackVerification");
const wrikeService = require("../services/wrikeService");
const databaseService = require("../services/databaseService");
const { openTaskModal } = require("./openTaskModal");
const slackApiHelper = require("../utils/slackApiHelper");

app.http("SlackSlashCommands", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "slack/commands",
	handler: async (request, context) => {
		const startTime = Date.now();

		try {
			// Parse form data immediately
			const rawBody = await request.text();
			const params = new URLSearchParams(rawBody);
			const command = {
				command: params.get("command"),
				text: params.get("text"),
				user_id: params.get("user_id"),
				channel_id: params.get("channel_id"),
				trigger_id: params.get("trigger_id"),
			};

			context.log(`Command ${command.command} received`);

			// Route to handler immediately based on command
			switch (command.command) {
				case "/task-test":
					return await slackApiHelper.postSlackMessageWithRetry(
						"https://slack.com/api/chat.postEphemeral",
						{
							channel: command.channel_id,
							user: command.user_id,
							blocks: [
								{
									type: "header",
									text: {
										type: "plain_text",
										text: "Création d'une nouvelle tâche",
										emoji: true,
									},
								},
								{
									type: "section",
									text: {
										type: "mrkdwn",
										text: `Bonjour <@${command.user_id}> ! Voici comment créer une  tâche :`,
									},
								},
								{
									type: "divider",
								},
								{
									type: "section",
									text: {
										type: "mrkdwn",
										text: "*Option 1:* Créez une tâche rapide avec la syntaxe suivante:",
									},
								},
								{
									type: "section",
									text: {
										type: "mrkdwn",
										text: "```\n/task\n```",
									},
								},
								{
									type: "context",
									elements: [
										{
											type: "mrkdwn",
											text: "💡 *Exemple:* `/task`",
										},
									],
								},

								{
									type: "divider",
								},
								{
									type: "section",
									text: {
										type: "mrkdwn",
										text: "*Option 2:* Utilisez le formulaire interactif ci-dessous",
									},
								},
								{
									type: "actions",
									elements: [
										{
											type: "button",
											text: {
												type: "plain_text",
												text: "📋 Ouvrir le formulaire",
												emoji: true,
											},
											style: "primary",
											action_id: "create_another_task",
											value: "create_task",
										},
									],
								},
							],
							text: `💰 Bonjour <@${command.user_id}> ! Pour créer une tâche, utilisez la commande directe ou le formulaire.`,
						},
						process.env.SLACK_BOT_TOKEN
					);
				case "/create-task":
					return await openTaskModal(command, context);

				default:
					return {
						status: 200,
						jsonBody: {
							response_type: "ephemeral",
							text: "❌ Unknown command",
						},
					};
			}
		} catch (error) {
			const duration = Date.now() - startTime;
			context.error(`Error after ${duration}ms:`, error.message);

			return {
				status: 200,
				jsonBody: {
					response_type: "ephemeral",
					text: "❌ An error occurred. Please try again.",
				},
			};
		}
	},
});

async function handleTaskCommand(command, context) {
	console.log("Handling task command:", command);
	const text = command.text?.trim();

	if (!text || text.toLowerCase() === "create") {
		return await openTaskModal(command, context);
	}

	const [action, ...args] = text.split(" ");

	switch (action.toLowerCase()) {
		case "create":
			return await openTaskModal(command, context);
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
	console.log("Updating task with args:", args);
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
	console.log("Handling Wrike command:", command);
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
	console.log("Handling help command:", command);
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
