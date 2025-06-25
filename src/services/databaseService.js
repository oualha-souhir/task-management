const mongoose = require("mongoose");
const Task = require("../models/Task");

// Suppress mongoose strictQuery deprecation warning
mongoose.set("strictQuery", false);

class DatabaseService {
	constructor() {
		this.isConnected = false;
		this.connectionPromise = null;
		this.retryCount = 0;
		this.maxRetries = 3;
		this.memoryStore = new Map(); // Initialize memory store
		this.lastConnectionAttempt = null;
		this.connectionCooldown = 30000; // 30 seconds cooldown between attempts
	}

	/**
	 * Connect to MongoDB with retry logic
	 */
	async connect() {
		if (this.isConnected) {
			return true;
		}

		if (this.connectionPromise) {
			return this.connectionPromise;
		}

		this.connectionPromise = this._connectToMongoDB();
		return this.connectionPromise;
	}

	async _connectToMongoDB() {
		try {
			const mongoUri = process.env.MONGODB_URI;

			if (!mongoUri || mongoUri === "your-mongodb-connection-string") {
				throw new Error("MongoDB connection string not configured");
			}

			await mongoose.connect(mongoUri, {
				useNewUrlParser: true,
				useUnifiedTopology: true,
				serverSelectionTimeoutMS: 10000, // Reduced timeout
				socketTimeoutMS: 45000,
				maxPoolSize: 10, // Maintain up to 10 socket connections
			});

			this.isConnected = true;
			this.retryCount = 0;
			console.log("Connected to MongoDB successfully");

			// Handle connection events
			mongoose.connection.on("error", (error) => {
				console.error("MongoDB connection error:", error);
				this.isConnected = false;
			});

			mongoose.connection.on("disconnected", () => {
				console.log("MongoDB disconnected");
				this.isConnected = false;
			});

			return true;
		} catch (error) {
			console.error("Failed to connect to MongoDB:", error.message);
			this.isConnected = false;
			this.connectionPromise = null;

			// Check if it's an IP whitelist issue
			if (error.message.includes("IP that isn't whitelisted")) {
				console.error("🚨 MongoDB Atlas IP Whitelist Issue:");
				console.error("   1. Go to https://cloud.mongodb.com");
				console.error("   2. Navigate to Network Access → IP Access List");
				console.error(
					"   3. Add your current IP address or 0.0.0.0/0 for development"
				);
			}

			throw error;
		}
	}

	/**
	 * Ensure connection with improved retry logic and cooldown
	 */
	async ensureConnection() {
		if (this.isConnected) {
			return true;
		}

		// Implement cooldown to avoid hammering MongoDB
		const now = Date.now();
		if (
			this.lastConnectionAttempt &&
			now - this.lastConnectionAttempt < this.connectionCooldown
		) {
			console.log("MongoDB connection on cooldown, using memory storage");
			return false;
		}

		try {
			this.lastConnectionAttempt = now;
			await this.connect();
			return true;
		} catch (error) {
			console.warn(
				`MongoDB unavailable (${error.message}), using in-memory storage for this session`
			);
			return false;
		}
	}

	/**
	 * Save task with fallback to in-memory storage
	 */
	async saveTask(taskData) {
		const isConnected = await this.ensureConnection();

		if (!isConnected) {
			// Fallback to in-memory storage
			return this._saveTaskInMemory(taskData);
		}

		try {
			const task = new Task({
				id: taskData.id || `task_${Date.now()}`,
				wrike_id: taskData.wrike_id,
				title: taskData.title,
				description: taskData.description || "",
				status: taskData.status || "Active",
				created_by: taskData.created_by,
				user_id: taskData.user_id,
				channel: taskData.channel,
				channel_id: taskData.channel_id,
				wrike_permalink: taskData.wrike_permalink,
				priority: taskData.priority || "Normal",
				due_date: taskData.due_date,
				assignees: taskData.assignees || [],
				tags: taskData.tags || [],
				wrike_synced: taskData.wrike_synced !== false,
			});

			const savedTask = await task.save();
			console.log("Task saved to MongoDB:", savedTask.id);
			return savedTask.toObject();
		} catch (error) {
			console.error("Error saving task to MongoDB:", error.message);
			// Fallback to in-memory storage
			return this._saveTaskInMemory(taskData);
		}
	}

	/**
	 * In-memory fallback storage
	 */
	_saveTaskInMemory(taskData) {
		if (!this.memoryStore) {
			this.memoryStore = new Map();
		}

		const task = {
			id: taskData.id || `task_${Date.now()}`,
			wrike_id: taskData.wrike_id,
			title: taskData.title,
			description: taskData.description || "",
			status: taskData.status || "Active",
			created_by: taskData.created_by,
			user_id: taskData.user_id,
			channel: taskData.channel,
			channel_id: taskData.channel_id,
			wrike_permalink: taskData.wrike_permalink,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			storage: "memory", // Flag to indicate this is in-memory
		};

		this.memoryStore.set(task.id, task);
		console.log("Task saved to memory store:", task.id);
		return task;
	}

	/**
	 * Get user tasks with fallback
	 */
	async getUserTasks(userId, status = null) {
		const isConnected = await this.ensureConnection();

		if (!isConnected) {
			return this._getUserTasksFromMemory(userId, status);
		}

		try {
			// Query by user_id or created_by (username)
			const query = {
				$or: [{ user_id: userId }, { created_by: userId }],
			};

			if (status) {
				query.status = status;
			}

			const tasks = await Task.find(query).sort({ created_at: -1 }).limit(50); // Limit to 50 most recent tasks

			return tasks.map((task) => task.toObject());
		} catch (error) {
			console.error("Error fetching user tasks from MongoDB:", error.message);
			return this._getUserTasksFromMemory(userId, status);
		}
	}

	_getUserTasksFromMemory(userId, status = null) {
		if (!this.memoryStore) {
			return [];
		}

		const allTasks = Array.from(this.memoryStore.values());
		let userTasks = allTasks.filter(
			(task) => task.user_id === userId || task.created_by === userId
		);

		if (status) {
			userTasks = userTasks.filter((task) => task.status === status);
		}

		return userTasks.sort(
			(a, b) => new Date(b.created_at) - new Date(a.created_at)
		);
	}

	/**
	 * Get task with fallback
	 */
	async getTask(taskId) {
		const isConnected = await this.ensureConnection();

		if (!isConnected) {
			return this.memoryStore?.get(taskId) || null;
		}

		try {
			const task = await Task.findOne({ id: taskId });
			return task ? task.toObject() : null;
		} catch (error) {
			console.error("Error fetching task from MongoDB:", error.message);
			return this.memoryStore?.get(taskId) || null;
		}
	}

	/**
	 * Update task with fallback
	 */
	async updateTask(taskId, updates) {
		const isConnected = await this.ensureConnection();

		if (!isConnected) {
			return this._updateTaskInMemory(taskId, updates);
		}

		try {
			const task = await Task.findOneAndUpdate(
				{ id: taskId },
				{
					...updates,
					updated_at: new Date(),
				},
				{
					new: true,
					runValidators: true,
				}
			);

			if (!task) {
				throw new Error(`Task ${taskId} not found`);
			}

			return task.toObject();
		} catch (error) {
			console.error("Error updating task in MongoDB:", error.message);
			return this._updateTaskInMemory(taskId, updates);
		}
	}

	_updateTaskInMemory(taskId, updates) {
		if (!this.memoryStore || !this.memoryStore.has(taskId)) {
			throw new Error(`Task ${taskId} not found`);
		}

		const task = this.memoryStore.get(taskId);
		const updatedTask = {
			...task,
			...updates,
			updated_at: new Date().toISOString(),
		};

		this.memoryStore.set(taskId, updatedTask);
		return updatedTask;
	}

	/**
	 * Delete task
	 * @param {string} taskId - Task ID
	 */
	async deleteTask(taskId) {
		await this.ensureConnection();

		try {
			const result = await Task.deleteOne({ id: taskId });
			return result.deletedCount > 0;
		} catch (error) {
			console.error("Error deleting task from MongoDB:", error);
			throw new Error(`Failed to delete task: ${error.message}`);
		}
	}

	/**
	 * Get task statistics for a user
	 * @param {string} userId - User ID or username
	 */
	async getUserTaskStats(userId) {
		const isConnected = await this.ensureConnection();

		if (!isConnected) {
			return this._getUserTaskStatsFromMemory(userId);
		}

		try {
			const stats = await Task.aggregate([
				{
					$match: {
						$or: [{ user_id: userId }, { created_by: userId }],
					},
				},
				{
					$group: {
						_id: "$status",
						count: { $sum: 1 },
					},
				},
			]);

			const result = {
				total: 0,
				active: 0,
				in_progress: 0,
				completed: 0,
				cancelled: 0,
			};

			stats.forEach((stat) => {
				result.total += stat.count;
				switch (stat._id.toLowerCase()) {
					case "active":
						result.active = stat.count;
						break;
					case "in progress":
						result.in_progress = stat.count;
						break;
					case "completed":
						result.completed = stat.count;
						break;
					case "cancelled":
						result.cancelled = stat.count;
						break;
				}
			});

			return result;
		} catch (error) {
			console.error(
				"Error fetching user task stats from MongoDB:",
				error.message
			);
			return this._getUserTaskStatsFromMemory(userId);
		}
	}

	_getUserTaskStatsFromMemory(userId) {
		const userTasks = this._getUserTasksFromMemory(userId);

		const result = {
			total: userTasks.length,
			active: 0,
			in_progress: 0,
			completed: 0,
			cancelled: 0,
		};

		userTasks.forEach((task) => {
			switch (task.status.toLowerCase()) {
				case "active":
					result.active++;
					break;
				case "in progress":
					result.in_progress++;
					break;
				case "completed":
					result.completed++;
					break;
				case "cancelled":
					result.cancelled++;
					break;
			}
		});

		return result;
	}

	/**
	 * Search tasks
	 * @param {string} query - Search query
	 * @param {string} userId - Optional user filter
	 */
	async searchTasks(query, userId = null) {
		await this.ensureConnection();

		try {
			const searchQuery = {
				$or: [
					{ title: { $regex: query, $options: "i" } },
					{ description: { $regex: query, $options: "i" } },
					{ tags: { $in: [new RegExp(query, "i")] } },
				],
			};

			if (userId) {
				searchQuery.$and = [
					searchQuery,
					{
						$or: [{ user_id: userId }, { created_by: userId }],
					},
				];
			}

			const tasks = await Task.find(searchQuery)
				.sort({ created_at: -1 })
				.limit(20);

			return tasks.map((task) => task.toObject());
		} catch (error) {
			console.error("Error searching tasks in MongoDB:", error);
			throw new Error(`Failed to search tasks: ${error.message}`);
		}
	}

	/**
	 * Close MongoDB connection
	 */
	async disconnect() {
		if (this.isConnected) {
			await mongoose.disconnect();
			this.isConnected = false;
			console.log("Disconnected from MongoDB");
		}
	}
}

module.exports = new DatabaseService();
