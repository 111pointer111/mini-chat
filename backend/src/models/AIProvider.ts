import mongoose, { Document, Schema } from 'mongoose';

export interface IAIProvider extends Document {
    name: string;
    baseURL: string;
    apiKey: string;
    modelName: string;
    enabled: boolean;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const aiProviderSchema = new Schema<IAIProvider>(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        baseURL: {
            type: String,
            required: true,
        },
        apiKey: {
            type: String,
            required: true,
        },
        modelName: {
            type: String,
            required: true,
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IAIProvider>('AIProvider', aiProviderSchema);
