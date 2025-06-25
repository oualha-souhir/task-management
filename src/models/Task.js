const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
	{
		id: {
			type: String,
			required: true,
			unique: true,
		},
		wrike_id: {
			type: String,
			required: false,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			default: "",
		},
		status: {
			type: String,
			enum: ["Active", "In Progress", "Completed", "Cancelled"],
			default: "Active",
		},
		created_by: {
			type: String,
			required: true,
		},
		user_id: {
			type: String,
			required: true,
			index: true,
		},
		channel: {
			type: String,
			required: true,
		},
		channel_id: {
			type: String,
			required: false,
		},
		wrike_permalink: {
			type: String,
			required: false,
		},
		priority: {
			type: String,
			enum: ["Low", "Normal", "High", "Critical"],
			default: "Normal",
		},
		due_date: {
			type: Date,
			required: false,
		},
		assignees: [
			{
				user_id: String,
				user_name: String,
			},
		],
		tags: [String],
		attachments: [
			{
				name: String,
				url: String,
				type: String,
			},
		],
	},
	{
		timestamps: {
			createdAt: "created_at",
			updatedAt: "updated_at",
		},
	}
);

// Add indexes for better query performance
taskSchema.index({ user_id: 1, status: 1 });
taskSchema.index({ channel: 1, status: 1 });
taskSchema.index({ created_at: -1 });

// Virtual for formatted creation date
taskSchema.virtual("formatted_created_at").get(function () {
	return this.created_at.toLocaleDateString();
});

// Static method to find user tasks
taskSchema.statics.findUserTasks = function (userId, status = null) {
	const query = { user_id: userId };
	if (status) {
		query.status = status;
	}
	return this.find(query).sort({ created_at: -1 });
};

// Static method to find channel tasks
taskSchema.statics.findChannelTasks = function (channel, status = null) {
	const query = { channel: channel };
	if (status) {
		query.status = status;
	}
	return this.find(query).sort({ created_at: -1 });
};

module.exports = mongoose.model("Task", taskSchema);
