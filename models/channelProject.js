const mongoose = require("mongoose");

const channelProjectSchema = new mongoose.Schema({
	channelId: {
		type: String,
		required: true,
		unique: true,
	},
	projectId: {
		type: String,
		required: true,
	},
	teamId: {
		type: String,
		required: true,
	},
	channelName: String,
	projectName: String,
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

channelProjectSchema.pre("save", function (next) {
	this.updatedAt = Date.now();
	next();
});

module.exports = mongoose.model("ChannelProject", channelProjectSchema);
