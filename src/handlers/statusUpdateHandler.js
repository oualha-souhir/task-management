const { WrikeService } = require("../services/wrikeService");
const { SlackService } = require("../services/slackService");
const { DatabaseService } = require("../services/databaseService");

async function handleStatusUpdate(taskId, newStatus, context) {
    try {
        const wrikeService = new WrikeService();
        const slackService = new SlackService();
        const databaseService = new DatabaseService();

        // Get task details from database
        const taskData = await databaseService.getTask(taskId);
        if (!taskData) {
            throw new Error(`Task ${taskId} not found in database`);
        }
console.log("taskData", taskData);
        const oldStatus = taskData.previousStatus || 'New';

        // Update status in Wrike
        await wrikeService.updateTaskStatus(taskId, newStatus);

        // Update status in database
        await databaseService.updateTaskStatus(taskId, newStatus);

        // Send status update notifications
        await slackService.notifyStatusUpdate(
            taskData,
            taskId,
            taskData.wrikePermalink,
            oldStatus,
            newStatus,
            context
        );

        // Update original messages if message info is stored
        if (taskData.channelMessageInfo) {
            await slackService.updateTaskMessage(
                taskData.channelMessageInfo,
                taskData,
                taskId,
                taskData.wrikePermalink,
                newStatus,
                context
            );
        }

        if (taskData.userMessageInfo) {
            await slackService.updateTaskMessage(
                taskData.userMessageInfo,
                taskData,
                taskId,
                taskData.wrikePermalink,
                newStatus,
                context
            );
        }

        return { success: true, oldStatus, newStatus };
    } catch (error) {
        context.error("Status update failed:", error.message);
        throw error;
    }
}

module.exports = { handleStatusUpdate };