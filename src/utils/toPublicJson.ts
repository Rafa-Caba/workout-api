export const toPublicJson = (ret: any, hiddenKeys: string[] = []) => {
    const { _id, __v, ...rest } = ret;

    for (const key of hiddenKeys) {
        delete rest[key];
    }

    return { id: String(_id), ...rest };
};
