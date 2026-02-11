import mongoose from "mongoose";
import env from "./env";

let isConnected = false;

export const connectDB = async (): Promise<void> => {
    if (isConnected) {
        console.log("🟢 MongoDB already connected");
        return;
    }

    try {
        mongoose.set("strictQuery", true);

        await mongoose.connect(env.MONGO_URI, {
            dbName: env.MONGO_DB_NAME,
            autoIndex: env.NODE_ENV !== "production",
        });

        isConnected = true;

        console.log("🟢 MongoDB connected");
        console.log(`📦 DB Name: ${env.MONGO_DB_NAME}`);

        mongoose.connection.on("error", (err) => {
            console.error("🔴 MongoDB runtime error:", err);
        });

        mongoose.connection.on("disconnected", () => {
            isConnected = false;
            console.warn("🟠 MongoDB disconnected");
        });
    } catch (error) {
        console.error("🔴 MongoDB connection failed:", error);
        process.exit(1);
    }
};

export const disconnectDB = async (): Promise<void> => {
    if (!isConnected) return;

    await mongoose.disconnect();
    isConnected = false;
    console.log("🟠 MongoDB disconnected gracefully");
};
