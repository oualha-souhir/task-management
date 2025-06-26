const { MongoClient } = require("mongodb");

class DatabaseService {
	constructor() {
		this.client = null;
		this.db = null;
		this.isConnected = false;
		this.connectionPromise = null;
	}

	async connect() {
		// Return existing connection if available
		if (this.isConnected && this.client) {
			return this.db;
		}

		// Return existing connection promise if connection is in progress
		if (this.connectionPromise) {
			return this.connectionPromise;
		}

		// Create new connection
		this.connectionPromise = this._establishConnection();
		return this.connectionPromise;
	}

	async _establishConnection() {
		const uri = process.env.MONGODB_URI;
		const dbName = process.env.DB_NAME || "taskmanager";

		if (!uri) {
			throw new Error("MONGODB_URI not found in environment variables");
		}

		try {
			// Azure Functions optimized connection options (updated timeouts)
			this.client = new MongoClient(uri, {
				maxPoolSize: 5, // Reduced pool size for serverless
				minPoolSize: 1,
				maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
				serverSelectionTimeoutMS: 10000, // Increased from 3000 to 10000ms for cold starts
				connectTimeoutMS: 10000, // Increased from 3000 to 10000ms
				socketTimeoutMS: 10000, // Increased from 3000 to 10000ms
				retryWrites: true,
				retryReads: true,
				compressors: ["zlib"], // Enable compression for better performance
				// Add these for better Azure Functions compatibility
				heartbeatFrequencyMS: 10000,
				maxConnecting: 2, // Limit concurrent connections
			});

			console.log("🔄 Attempting MongoDB connection...");
			await this.client.connect();

			// Test the connection with a ping
			await this.client.db("admin").command({ ping: 1 });

			this.db = this.client.db(dbName);
			this.isConnected = true;
			this.connectionPromise = null;

			console.log("✅ MongoDB connected successfully");
			return this.db;
		} catch (error) {
			this.connectionPromise = null;
			this.isConnected = false;
			this.client = null;
			console.error("❌ MongoDB connection failed:", error.message);

			// Provide more specific error context
			if (error.message.includes("timed out")) {
				console.error("💡 Connection timeout - possible causes:");
				console.error("   1. Network latency between Azure and MongoDB Atlas");
				console.error("   2. MongoDB Atlas cluster might be paused");
				console.error("   3. IP whitelist restrictions");
				console.error("   4. DNS resolution issues");
			}

			throw error;
		}
	}

	async executeWithRetry(
		operation,
		operationName = "Database operation",
		maxRetries = 2
	) {
		let lastError;

		for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
			try {
				const db = await this.connect();
				return await operation(db);
			} catch (error) {
				lastError = error;
				console.error(
					`${operationName} attempt ${attempt} failed:`,
					error.message
				);

				if (attempt <= maxRetries) {
					// Reset connection on error
					this.isConnected = false;
					this.connectionPromise = null;

					// Progressive delay: 1s, 2s, 3s
					const delayMs = 1000 * attempt;
					console.log(`⏳ Retrying in ${delayMs}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delayMs));
				} else {
					console.error(
						`${operationName} failed after ${maxRetries + 1} attempts`
					);
				}
			}
		}

		throw lastError;
	}

	// Fire-and-forget save operation for Azure Functions
	saveTaskAsync(task) {
		// Don't return the promise to prevent Azure Functions from waiting
		this.executeWithRetry(async (db) => {
			console.log(
				"💾 Saving task to MongoDB (async):",
				task.title || "Untitled"
			);
			const collection = db.collection("tasks");

			// Add metadata for tracking
			const taskWithMetadata = {
				...task,
				createdAt: new Date(),
				// updatedAt: new Date(),
			};

			const result = await collection.insertOne(taskWithMetadata);
			console.log(
				"✅ Task saved successfully (async) with ID:",
				result.insertedId
			);
			return result;
		}, "Save task to database (async)").catch((error) => {
			// Log error but don't throw - prevents Azure Function warnings
			console.error("❌ Background task save failed:", error.message);
		});

		// Return immediately
		console.log("🚀 Background database save initiated");
	}

	async saveTask(task) {
		return this.executeWithRetry(async (db) => {
			console.log("Saving task to MongoDB:", task);
			const collection = db.collection("tasks");

			const taskWithMetadata = {
				...task,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const result = await collection.insertOne(taskWithMetadata);
			console.log("✅ Task saved successfully");
			return result.insertedId
				? { ...taskWithMetadata, _id: result.insertedId }
				: taskWithMetadata;
		}, "Save task to database");
	}

	async getUserTasks(userName) {
		return this.executeWithRetry(async (db) => {
			console.log("Fetching tasks for user:", userName);
			const collection = db.collection("tasks");
			return await collection.find({ created_by: userName }).toArray();
		}, "Get user tasks");
	}

	async getUserTaskStats(userName) {
		return this.executeWithRetry(async (db) => {
			console.log("Fetching task stats for user:", userName);
			const collection = db.collection("tasks");

			const [total, active, completed] = await Promise.all([
				collection.countDocuments({ created_by: userName }),
				collection.countDocuments({ created_by: userName, status: "Active" }),
				collection.countDocuments({
					created_by: userName,
					status: "Completed",
				}),
			]);

			return { total, active, completed };
		}, "Get user task stats");
	}

	async updateTask(taskId, updates) {
		return this.executeWithRetry(async (db) => {
			console.log("Updating task:", taskId, "with updates:", updates);
			const collection = db.collection("tasks");

			const updateData = {
				...updates,
				updatedAt: new Date(),
			};

			await collection.updateOne({ id: taskId }, { $set: updateData });
			return await collection.findOne({ id: taskId });
		}, "Update task");
	}

	// Graceful cleanup for Azure Functions
	async disconnect() {
		if (this.client) {
			try {
				await this.client.close();
				console.log("🔌 MongoDB connection closed");
			} catch (error) {
				console.error("Error closing MongoDB connection:", error.message);
			} finally {
				this.client = null;
				this.db = null;
				this.isConnected = false;
				this.connectionPromise = null;
			}
		}
	}
}

// Export singleton instance
const databaseService = new DatabaseService();

module.exports = {
	saveTask: (task) => databaseService.saveTask(task),
	saveTaskAsync: (task) => databaseService.saveTaskAsync(task),
	getUserTasks: (userName) => databaseService.getUserTasks(userName),
	getUserTaskStats: (userName) => databaseService.getUserTaskStats(userName),
	updateTask: (taskId, updates) => databaseService.updateTask(taskId, updates),
	disconnect: () => databaseService.disconnect(),
	// Export the service instance for advanced usage
	instance: databaseService,
};
