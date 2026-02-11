import type { Request, Response } from "express";
import {
    getDaySummary,
    getMediaStats,
    getPlanVsActualWeek,
    getRangeSummary,
    getWeeksTrend,
    getWeekSummary,
} from "../services/workoutSummary.service";

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

const getValidatedQuery = (req: Request) => {
    const anyReq = req as any;
    return anyReq.validatedQuery ?? anyReq.validated?.query ?? req.query;
};

export const getDaySummaryController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);
    const out = await getDaySummary(userId, date);
    return res.status(200).json(out);
};

export const getWeekSummaryController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);
    const out = await getWeekSummary(userId, weekKey);
    return res.status(200).json(out);
};

export const getRangeSummaryController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = getValidatedQuery(req);
    const out = await getRangeSummary(userId, String(q.from), String(q.to));
    return res.status(200).json(out);
};

export const getWeeksTrendController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = getValidatedQuery(req);

    // after schema fix, q.toWeek will already be defaulted to q.fromWeek
    const fromWeek = String(q.fromWeek);
    const toWeek = String(q.toWeek);
    const limitWeeks = q.limitWeeks == null ? undefined : Number(q.limitWeeks);

    const out = await getWeeksTrend(userId, fromWeek, toWeek, limitWeeks);
    return res.status(200).json(out);
};

export const getPlanVsActualWeekController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);
    const out = await getPlanVsActualWeek(userId, weekKey);
    return res.status(200).json(out);
};

export const getMediaStatsController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = getValidatedQuery(req);

    const source = (q.source ?? "all") as "day" | "routine" | "all";

    const out = await getMediaStats(userId, String(q.from), String(q.to), source);
    return res.status(200).json(out);
};