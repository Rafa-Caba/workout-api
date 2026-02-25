import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const TrainingLevelEnum = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

const CoachTraineeProfileSchema = new Schema(
    {
        traineeId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        trainerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        coachAssessedLevel: {
            type: String,
            enum: TrainingLevelEnum,
            default: null,
            index: true,
        },

        coachNotes: { type: String, default: null, maxlength: 8000 },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: any) => {
                const { _id, __v, ...rest } = ret;
                return { id: String(_id), ...rest };
            },
        },
    }
);

CoachTraineeProfileSchema.index(
    { traineeId: 1, trainerId: 1 },
    { unique: true }
);

export type CoachTraineeProfileDocument = InferSchemaType<
    typeof CoachTraineeProfileSchema
> & {
    id: string;
};

export const CoachTraineeProfileModel: Model<CoachTraineeProfileDocument> =
    mongoose.models.CoachTraineeProfile ||
    mongoose.model<CoachTraineeProfileDocument>(
        "CoachTraineeProfile",
        CoachTraineeProfileSchema
    );