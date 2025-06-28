const { MongoClient } = require("mongodb");

class DatabaseService {
    constructor() {
        this.client = null;
        this.db = null;
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected && this.db) return this.db;

        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI not configured");

        this.client = new MongoClient(uri, {
            maxPoolSize: 5,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        });

        await this.client.connect();
        this.db = this.client.db(process.env.DB_NAME || "taskmanager");
        this.isConnected = true;
        console.log("MongoDB connected");
        return this.db;
    }

    async saveTaskAsync(task) {
        try {
            const db = await this.connect();
            const collection = db.collection("tasks");
            const taskWithMetadata = { ...task, createdAt: new Date() };
            const result = await collection.insertOne(taskWithMetadata);
            console.log(`Task saved with ID: ${result.insertedId}`);
            return result.insertedId;
        } catch (error) {
            console.error("Background task save failed:", error.message);
            throw error;
        }
    }

    // Add the missing saveTask method
    async saveTask(taskData) {
        try {
            const db = await this.connect();
            const collection = db.collection("tasks");
            
            const taskToSave = {
                ...taskData,
                createdAt: taskData.createdAt || new Date().toISOString(),
                updatedAt: taskData.updatedAt || new Date().toISOString(),
            };

            const result = await collection.insertOne(taskToSave);
            console.log(`Task saved with ID: ${result.insertedId}`);
            return result.insertedId;
        } catch (error) {
            console.error("Task save failed:", error.message);
            throw error;
        }
    }

    async saveTaskWithMessageInfo(taskData, channelMessageInfo, userMessageInfo) {
        const taskToSave = {
            ...taskData,
            channelMessageInfo,
            userMessageInfo,
            status: "New", // Default status
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Use saveTask instead of saveTaskAsync for consistency
        return await this.saveTask(taskToSave);
    }

    // Add the missing findTask method
    async findTask(taskId) {
        try {
            const db = await this.connect();
            const collection = db.collection("tasks");
            
            // Try to find by wrikeTaskId first, then by _id as fallback
            let task = await collection.findOne({ wrikeTaskId: taskId });
            
            if (!task) {
                // Try finding by _id if taskId looks like an ObjectId
                try {
                    const { ObjectId } = require("mongodb");
                    if (ObjectId.isValid(taskId)) {
                        task = await collection.findOne({ _id: new ObjectId(taskId) });
                    }
                } catch (objectIdError) {
                    // Ignore ObjectId conversion errors
                }
            }
            
            if (!task) {
                console.log(`Task with ID ${taskId} not found`);
                return null;
            }

            console.log(`Task found: ${task.wrikeTaskId || task._id}`);
            return task;
        } catch (error) {
            console.error("Task retrieval failed:", {
                taskId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // Add the missing updateTask method
    async updateTask(taskId, updateData) {
        try {
            const db = await this.connect();
            const collection = db.collection("tasks");
            
            const dataToUpdate = {
                ...updateData,
                updatedAt: new Date().toISOString(),
            };

            // Try to update by wrikeTaskId first
            let result = await collection.updateOne(
                { wrikeTaskId: taskId },
                { $set: dataToUpdate }
            );

            // If no match found, try by _id
            if (result.matchedCount === 0) {
                try {
                    const { ObjectId } = require("mongodb");
                    if (ObjectId.isValid(taskId)) {
                        result = await collection.updateOne(
                            { _id: new ObjectId(taskId) },
                            { $set: dataToUpdate }
                        );
                    }
                } catch (objectIdError) {
                    // Ignore ObjectId conversion errors
                }
            }

            if (result.matchedCount === 0) {
                throw new Error(`Task with ID ${taskId} not found`);
            }

            console.log(`Task ${taskId} updated successfully`);
            return result;
        } catch (error) {
            console.error("Task update failed:", {
                taskId,
                updateData,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        return await this.updateTask(taskId, {
            status: newStatus,
        });
    }

    async getTask(taskId) {
        return await this.findTask(taskId);
    }

    // Add method to get all tasks for debugging
    async getAllTasks() {
        try {
            const db = await this.connect();
            const collection = db.collection("tasks");
            const tasks = await collection.find({}).toArray();
            console.log(`Retrieved ${tasks.length} tasks from database`);
            return tasks;
        } catch (error) {
            console.error("Failed to retrieve all tasks:", error.message);
            throw error;
        }
    }

    // Add method to delete a task
    async deleteTask(taskId) {
        try {
            const db = await this.connect();
            const collection = db.collection("tasks");
            
            let result = await collection.deleteOne({ wrikeTaskId: taskId });
            
            // If no match found, try by _id
            if (result.deletedCount === 0) {
                try {
                    const { ObjectId } = require("mongodb");
                    if (ObjectId.isValid(taskId)) {
                        result = await collection.deleteOne({ _id: new ObjectId(taskId) });
                    }
                } catch (objectIdError) {
                    // Ignore ObjectId conversion errors
                }
            }
            
            if (result.deletedCount === 0) {
                throw new Error(`Task with ID ${taskId} not found`);
            }

            console.log(`Task ${taskId} deleted successfully`);
            return result;
        } catch (error) {
            console.error("Task deletion failed:", error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            this.isConnected = false;
            console.log("MongoDB disconnected");
        }
    }
}

module.exports = { DatabaseService };
