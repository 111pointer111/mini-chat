import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
    name: string;
    description?: string;
    ownerId: mongoose.Types.ObjectId;
    avatar?: string;
    assistantEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 300,
        },
        ownerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        avatar: {
            type: String,
            default: '',
        },
        assistantEnabled: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

groupSchema.index({ ownerId: 1, updatedAt: -1 });

export default mongoose.model<IGroup>('Group', groupSchema);
