export const parseDurationToMs = (value: string): number => {
    const trimmed = value.trim().toLowerCase();
    const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/);

    if (!match) {
        throw new Error(`Invalid duration format: "${value}" (expected e.g. 15m, 30d, 1h)`);
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
    };

    return amount * multipliers[unit];
};
