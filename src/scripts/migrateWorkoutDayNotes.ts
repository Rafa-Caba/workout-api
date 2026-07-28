// src/scripts/migrateWorkoutDayNotes.ts
// One-time deployment migration from WorkoutDay.meta.dayNotes to dayNotes.

import { connectDB, disconnectDB } from "../config/db";
import { migrateAllLegacyWorkoutDayNotes } from "../services/workoutDayNotes.service";

async function run(): Promise<void> {
    await connectDB();

    try {
        const result = await migrateAllLegacyWorkoutDayNotes();

        console.log("✅ WorkoutDay note migration completed", result);
    } finally {
        await disconnectDB();
    }
}

run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ WorkoutDay note migration failed:", message);
    process.exitCode = 1;
});
