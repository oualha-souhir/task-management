const express = require("express");
const Task = require("../models/task");
const { updateTaskInSlack } = require("./slackMessageService");
const wrikeApi = require("./wrikeApi");

// Setup a simple express server to receive Wrike webhooks
const setupWrikeWebhooks = () => {
	const app = express();
	app.use(express.json());

	app.post("/wrike-webhook", async (req, res) => {
		try {
			const { type, taskId, eventData } = req.body;

			// Handle task updates from Wrike
			if (type === "TaskStatusChanged" || type === "TaskUpdated") {
				const task = await Task.findOne({ wrikeTaskId: taskId });

				if (task) {
					const wrikeTask = await wrikeApi.getTask(taskId);

					// Update our local task data
					task.status = wrikeTask.status.toLowerCase();
					if (wrikeTask.responsibles && wrikeTask.responsibles.length > 0) {
						task.assigneeWrikeId = wrikeTask.responsibles[0];
					}

					await task.save();

					// Update the task message in Slack
					await updateTaskInSlack(task);
				}
			}

			res.status(200).send("Webhook processed");
		} catch (error) {
			console.error("Error processing Wrike webhook:", error);
			res.status(500).send("Error processing webhook");
		}
	});

	const port = process.env.WEBHOOK_PORT || 3001;
	app.listen(port, () => {
		console.log(`Wrike webhook server listening on port ${port}`);
	});
};

module.exports = { setupWrikeWebhooks };
