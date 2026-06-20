// src/controllers/userMetric.controller.ts
import type { Request, Response } from "express";
import * as userMetricService from "../services/userMetric.service";
import type {
    UserMetricDateParamsParsed,
    UserMetricListQueryParsed,
} from "../validations/userMetric.schemas";

const getUserIdFromReq = (req: Request): string => String(req.user?.id ?? "");

const getValidatedQuery = (req: Request): UserMetricListQueryParsed => {
    const query = req.validatedQuery ?? req.query;
    return query as UserMetricListQueryParsed;
};

const getValidatedParams = (req: Request): UserMetricDateParamsParsed => {
    const params = req.validatedParams ?? req.params;
    return params as UserMetricDateParamsParsed;
};

export const listMyUserMetricsController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const query = getValidatedQuery(req);

    const out = await userMetricService.listMyUserMetrics(userId, query);
    return res.status(200).json(out);
};

export const getLatestUserMetricController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);

    const out = await userMetricService.getLatestUserMetric(userId);
    return res.status(200).json(out);
};

export const upsertMyUserMetricByDateController = async (
    req: Request,
    res: Response
) => {
    const userId = getUserIdFromReq(req);
    const params = getValidatedParams(req);

    // console.log({ boddy: req.body });

    const out = await userMetricService.upsertMyUserMetricByDate(
        userId,
        params.date,
        req.body
    );

    return res.status(200).json(out);
};

export const deleteMyUserMetricByDateController = async (
    req: Request,
    res: Response
) => {
    const userId = getUserIdFromReq(req);
    const params = getValidatedParams(req);

    const out = await userMetricService.deleteMyUserMetricByDate(
        userId,
        params.date
    );

    return res.status(200).json(out);
};