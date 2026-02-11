import app from "./app";
import env from "./config/env";
import { connectDB, disconnectDB } from "./config/db";

const startServer = async () => {
    await connectDB();

    const server = app.listen(env.PORT, () => {
        console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    });

    const shutdown = async (signal: string) => {
        console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
        server.close(async () => {
            await disconnectDB();
            console.log("✅ Shutdown complete");
            process.exit(0);
        });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    process.on("unhandledRejection", (reason) => {
        console.error("❌ Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", (err) => {
        console.error("❌ Uncaught Exception:", err);

        process.exit(1);
    });
};

startServer().catch((err) => {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
});
