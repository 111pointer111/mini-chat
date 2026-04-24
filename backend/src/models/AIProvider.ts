import mongoose, { Document, Schema } from 'mongoose';

export interface IAIProvider extends Document {
    name: string;
    baseURL: string;
    apiKey: string;
    modelName: string;
    embeddingModel?: string;    // Embedding 模型名（如 embo-01，默认用 text-embedding-ada-002）
    embeddingBaseURL?: string;  // Embedding 专用接口（如 Minimax 用不同地址）
    groupId?: string;           // 部分 provider 需要额外参数（如 Minimax）
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
        embeddingBaseURL: {
            type: String,
            required: false,
        },
        embeddingModel: {
            type: String,
            required: false,
        },
        groupId: {
            type: String,
            required: false,
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
