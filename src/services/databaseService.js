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
      const db = await this.connect(); // Ensure connection is established
      const collection = db.collection("tasks");
      const taskWithMetadata = { ...task, createdAt: new Date() };
      const result = await collection.insertOne(taskWithMetadata);
      console.log(`Task saved with ID: ${result.insertedId}`);
    } catch (error) {
      console.error("Background task save failed:", error.message);
      throw error; // Re-throw to allow caller to handle
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