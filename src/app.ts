import express from "express";
import cors from "cors";
import { corsOptions } from "./config/cors";
import cookieParser from "cookie-parser";
import env from "./config/env";

import authRoutes from "./routes/auth.routes";
import adminUserRoutes from "./routes/adminUser.routes";
import adminSettingsRouter from "./routes/adminSettings.routes";
import trainerRoutes from "./routes/trainer.routes";
import userRoutes from "./routes/user.routes";
import workoutDayRoutes from "./routes/workoutDay.routes";
import workoutSessionRoutes from "./routes/workoutSession.routes";
import workoutMediaRoutes from "./routes/workoutMedia.routes";
import workoutRoutineRoutes from "./routes/workoutRoutine.routes";
import workoutSummaryRoutes from "./routes/workoutSummary.routes";
import workoutInsightsRoutes from "./routes/workoutInsights.routes";
import workoutExportRoutes from "./routes/workoutExport.routes";
import movementRoutes from "./routes/movement.routes";
import settingsRoutes from "./routes/settings.routes";
import publicAppSettingsRoutes from "./routes/publicAppSettings.routes";

import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/settings", adminSettingsRouter);
app.use("/api/trainer", trainerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/workout", workoutDayRoutes);
app.use("/api/workout", workoutSessionRoutes);
app.use("/api/workout", workoutMediaRoutes);
app.use("/api/workout", workoutRoutineRoutes);
app.use("/api/workout", workoutSummaryRoutes);
app.use("/api/workout", workoutInsightsRoutes);
app.use("/api/workout", workoutExportRoutes);
app.use("/api/app-settings", publicAppSettingsRoutes);
app.use("/api", movementRoutes);

app.use(errorHandler);

export default app;
