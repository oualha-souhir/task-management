const mongoose = require("mongoose");
require("dotenv").config();

async function testMongoConnection() {
	console.log("🔍 Testing MongoDB Connection...");

	const mongoUri = process.env.MONGODB_URI;
	console.log("MongoDB URI:", mongoUri ? "Present" : "Missing");

	if (!mongoUri) {
		console.error("❌ MONGODB_URI not found in environment variables");
		return;
	}

	try {
		console.log("📡 Attempting to connect to MongoDB Atlas...");

		await mongoose.connect(mongoUri, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			serverSelectionTimeoutMS: 10000,
		});

		console.log("✅ MongoDB connection successful!");

		// Test database operations
		const testCollection = mongoose.connection.db.collection("test");

		// Insert test document
		const testDoc = {
			message: "Hello from Azure Functions!",
			timestamp: new Date(),
		};
		const insertResult = await testCollection.insertOne(testDoc);
		console.log("✅ Test document inserted:", insertResult.insertedId);

		// Read test document
		const readResult = await testCollection.findOne({
			_id: insertResult.insertedId,
		});
		console.log("✅ Test document read:", readResult.message);

		// Delete test document
		await testCollection.deleteOne({ _id: insertResult.insertedId });
		console.log("✅ Test document cleaned up");

		console.log("🎉 MongoDB is fully operational!");
	} catch (error) {
		console.error("❌ MongoDB connection failed:");
		console.error("Error type:", error.name);
		console.error("Error message:", error.message);

		if (error.message.includes("bad auth")) {
			console.error("\n💡 Authentication failed - possible solutions:");
			console.error("   1. Check username and password in connection string");
			console.error(
				"   2. Verify user exists in MongoDB Atlas Database Access"
			);
			console.error(
				'   3. Ensure user has "Read and write to any database" privileges'
			);
			console.error("   4. Try recreating the database user");
		}

		if (error.message.includes("IP")) {
			console.error(
				"\n💡 IP whitelist issue - add your IP to Atlas Network Access"
			);
		}
	} finally {
		await mongoose.disconnect();
		console.log("🔌 Disconnected from MongoDB");
	}
}

testMongoConnection();
