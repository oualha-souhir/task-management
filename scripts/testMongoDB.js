const databaseService = require("../src/services/databaseService");
const healthCheck = require("../src/utils/connectionHealthCheck");
require("dotenv").config();

async function testMongoConnection() {
	console.log(
		"🔍 Testing MongoDB Connection with Azure Functions optimizations..."
	);

	try {
		// First, check MongoDB Atlas status
		console.log("🌐 Checking MongoDB Atlas status...");
		const atlasStatus = await healthCheck.checkAtlasStatus();
		console.log("Atlas Status:", atlasStatus);
		console.log(healthCheck.getAdvice(atlasStatus));

		if (!atlasStatus.healthy) {
			console.error("❌ MongoDB Atlas is not accessible, aborting tests");
			return;
		}

		console.log("📡 Testing connection with retry logic...");

		// Test basic connection
		await databaseService.instance.connect();
		console.log("✅ MongoDB connection successful!");

		// Test task operations with Azure Functions optimized service
		console.log("🧪 Testing task operations...");

		const testTaskData = {
			id: `TEST_${Date.now()}`,
			wrikeTaskId: `WRIKE_${Date.now()}`,
			title: "Test Task from Azure Functions",
			description: "Testing Azure Functions optimized database operations",
			assignee: "Test User",
			status: "Active",
			created_by: "test_user",
			dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
			slackUserId: "U123456789",
			slackChannelId: "C123456789",
		};

		// Test synchronous save operation
		console.log("💾 Testing synchronous save operation...");
		const savedTask = await databaseService.saveTask(testTaskData);
		console.log("✅ Task saved successfully:", savedTask._id || "ID generated");

		// Test asynchronous save operation (fire-and-forget)
		console.log("🚀 Testing asynchronous save operation...");
		const asyncTaskData = {
			...testTaskData,
			id: `TEST_ASYNC_${Date.now()}`,
			title: "Async Test Task",
		};

		console.log("✅ Async save operation initiated");

		// Test get operations
		console.log("📖 Testing get operations...");
		const userTasks = await databaseService.getUserTasks("test_user");
		console.log("✅ Retrieved user tasks:", userTasks.length);

		const userStats = await databaseService.getUserTaskStats("test_user");
		console.log("✅ User stats retrieved:", userStats);

		// Test update operation
		console.log("📝 Testing update operation...");
		const updatedTask = await databaseService.updateTask(testTaskData.id, {
			status: "Completed",
			description: "Updated via Azure Functions test",
		});
		console.log("✅ Task updated successfully:", updatedTask?.status);

		// Clean up test data
		console.log("🧹 Cleaning up test data...");
		await databaseService.instance.executeWithRetry(async (db) => {
			const collection = db.collection("tasks");
			await collection.deleteMany({
				$or: [{ id: testTaskData.id }, { id: asyncTaskData.id }],
			});
		}, "Delete test tasks");
		console.log("✅ Test data cleaned up");

		console.log(
			"🎉 All Azure Functions database operations completed successfully!"
		);
	} catch (error) {
		console.error("❌ Database test failed:");
		console.error("Error type:", error.name);
		console.error("Error message:", error.message);

		if (error.message.includes("bad auth")) {
			console.error("\n💡 Authentication failed - possible solutions:");
			console.error("   1. Check username and password in connection string");
			console.error(
				"   2. Verify user exists in MongoDB Atlas Database Access"
			);
			console.error(
				"   3. Ensure user has 'Read and write to any database' privileges"
			);
		}

		if (error.message.includes("timeout")) {
			console.error(
				"\n💡 Connection timeout - Azure Functions specific solutions:"
			);
			console.error(
				"   1. Verify MongoDB Atlas cluster is in the same region as Azure Functions"
			);
			console.error(
				"   2. Check if your Azure Functions IP is whitelisted in Atlas"
			);
			console.error(
				"   3. Consider using MongoDB connection string with shorter timeouts"
			);
		}

		if (
			error.message.includes("ENOTFOUND") ||
			error.message.includes("network")
		) {
			console.error("\n💡 Network connectivity issue:");
			console.error("   1. Check MongoDB Atlas network access settings");
			console.error("   2. Verify DNS resolution from Azure Functions");
		}
	} finally {
		await databaseService.disconnect();
		console.log("🔌 Disconnected from MongoDB");
	}
}

// Add timeout to prevent hanging in Azure Functions environment
const testTimeout = setTimeout(() => {
	console.error("❌ Test timed out after 30 seconds");
	process.exit(1);
}, 30000);

testMongoConnection().finally(() => {
	clearTimeout(testTimeout);
});
