// src/routes/userMetric.routes.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as userMetricController from "../controllers/userMetric.controller";
import {
    upsertUserMetricBodySchema,
    userMetricDateParamsSchema,
    userMetricListQuerySchema,
} from "../validations/userMetric.schemas";

const router = Router();

// GET /api/users/me/body-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get(
    "/me/body-metrics",
    requireAuth,
    validate("query", userMetricListQuerySchema),
    userMetricController.listMyUserMetricsController
);

// GET /api/users/me/body-metrics/latest
router.get(
    "/me/body-metrics/latest",
    requireAuth,
    userMetricController.getLatestUserMetricController
);

// PUT /api/users/me/body-metrics/:date
router.put(
    "/me/body-metrics/:date",
    requireAuth,
    validate({
        params: userMetricDateParamsSchema,
        body: upsertUserMetricBodySchema,
    }),
    userMetricController.upsertMyUserMetricByDateController
);

// DELETE /api/users/me/body-metrics/:date
router.delete(
    "/me/body-metrics/:date",
    requireAuth,
    validate("params", userMetricDateParamsSchema),
    userMetricController.deleteMyUserMetricByDateController
);

export default router;