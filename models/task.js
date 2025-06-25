const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
	slackTs: {
		type: String,
		required: true,
		unique: true,
	},
	wrikeTaskId: {
		type: String,
		required: true,
		unique: true,
	},
	channelId: {
		type: String,
		required: true,
	},
	title: {
		type: String,
		required: true,
	},
	description: String,
	status: {
		type: String,
		enum: ["active", "completed", "deferred", "cancelled"],
		default: "active",
	},
	assigneeSlackId: String,
	assigneeWrikeId: String,
	dueDate: Date,
	createdBy: String,
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

taskSchema.pre("save", function (next) {
	this.updatedAt = Date.now();
	next();
});

module.exports = mongoose.model("Task", taskSchema);
