const pad2 = (n: number) => String(n).padStart(2, "0");

const toISODate = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = pad2(d.getUTCMonth() + 1);
    const day = pad2(d.getUTCDate());
    return `${y}-${m}-${day}`;
};

/**
 * Returns ISO week key like "2026-W04" for an ISO date string YYYY-MM-DD
 */
export const getISOWeekKey = (isoDate: string): string => {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));

    // ISO week: Thursday decides the year
    const day = date.getUTCDay() || 7; // Sunday=0 -> 7
    date.setUTCDate(date.getUTCDate() + 4 - day);

    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
};

/**
 * Given "2026-W04", returns Monday startDate and Sunday endDate as YYYY-MM-DD
 */
export const getISOWeekDateRange = (weekKey: string): { startDate: string; endDate: string } => {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
    if (!match) throw new Error("Invalid weekKey format (YYYY-Www)");

    const year = Number(match[1]);
    const week = Number(match[2]);

    // ISO week 1 is the week with Jan 4th in it.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; // Monday=1..Sunday=7

    // Monday of week 1
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

    // Monday of target week
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    return { startDate: toISODate(start), endDate: toISODate(end) };
};

const toUTCDate = (isoDate: string) => {
    // isoDate expected: YYYY-MM-DD
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
};

export const getWeekKeyFromISODate = (isoDate: string) => {
    const date = toUTCDate(isoDate);

    // ISO week date algorithm (UTC)
    // Thursday in current week decides the year
    const day = date.getUTCDay() || 7; // 1..7 (Mon..Sun)
    date.setUTCDate(date.getUTCDate() + 4 - day);

    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
};
