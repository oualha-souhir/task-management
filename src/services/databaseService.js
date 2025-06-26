const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = process.env.DB_NAME;

async function connect() {
    console.log("Connecting to MongoDB...");
    if (!client.isConnected()) {
        await client.connect();
    }
    return client.db(dbName);
}

async function saveTask(task) {
    console.log("Saving task to MongoDB:", task);
    const db = await connect();
    const collection = db.collection("tasks");
    const result = await collection.insertOne(task);
    return result.ops[0];
}

async function getUserTasks(userName) {
    console.log("Fetching tasks for user:", userName);
    const db = await connect();
    const collection = db.collection("tasks");
    return await collection.find({ created_by: userName }).toArray();
}

async function getUserTaskStats(userName) {
    console.log("Fetching task stats for user:", userName);
    const db = await connect();
    const collection = db.collection("tasks");
    const total = await collection.countDocuments({ created_by: userName });
    const active = await collection.countDocuments({ created_by: userName, status: "Active" });
    const completed = await collection.countDocuments({ created_by: userName, status: "Completed" });

    return { total, active, completed };
}

async function updateTask(taskId, updates) {
    console.log("Updating task:", taskId, "with updates:", updates);
    const db = await connect();
    const collection = db.collection("tasks");
    await collection.updateOne({ id: taskId }, { $set: updates });
    return await collection.findOne({ id: taskId });
}

module.exports = {
    saveTask,
    getUserTasks,
    getUserTaskStats,
    updateTask,
};