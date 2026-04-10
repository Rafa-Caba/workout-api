// src/controllers/bodyProgress.controller.ts
import type { Request, Response } from "express";
import { getBodyProgressOverview } from "../services/bodyProgress.service";
import type { BodyProgressOverviewQueryParsed } from "../validations/bodyProgress.schemas";

const getUserIdFromReq = (req: Request): string => String(req.user?.id ?? "");

const getValidatedQuery = (req: Request): BodyProgressOverviewQueryParsed => {
    const query = req.validatedQuery ?? req.query;
    return query as BodyProgressOverviewQueryParsed;
};

export const getBodyProgressOverviewController = async (
    req: Request,
    res: Response
) => {
    const userId = getUserIdFromReq(req);
    const query = getValidatedQuery(req);

    const out = await getBodyProgressOverview(userId, {
        mode: query.mode,
        from: query.from,
        to: query.to,
        compareTo: query.compareTo,
    });

    return res.status(200).json(out);
};