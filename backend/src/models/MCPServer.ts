import mongoose, { Document, Schema } from 'mongoose';

export interface IMCPTool {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
}

export interface IMCPHeader {
    key: string;
    value: string;
}

export interface IMCPServer extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    description?: string;
    transport: 'http' | 'sse';
    url: string;
    headers: IMCPHeader[];
    enabled: boolean;
    cachedTools: IMCPTool[];
    lastConnectedAt?: Date;
    lastError?: string;
    createdAt: Date;
    updatedAt: Date;
}

const mcpToolSchema = new Schema<IMCPTool>(
    {
        name: { type: String, required: true },
        description: { type: String },
        inputSchema: {
            type: Schema.Types.Mixed,
            default: { type: 'object', properties: {} },
        },
    },
    { _id: false }
);

const mcpHeaderSchema = new Schema<IMCPHeader>(
    {
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true },
    },
    { _id: false }
);

const mcpServerSchema = new Schema<IMCPServer>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        transport: {
            type: String,
            enum: ['http', 'sse'],
            default: 'http',
        },
        url: {
            type: String,
            required: true,
            trim: true,
        },
        headers: {
            type: [mcpHeaderSchema],
            default: [],
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        cachedTools: {
            type: [mcpToolSchema],
            default: [],
        },
        lastConnectedAt: {
            type: Date,
        },
        lastError: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

mcpServerSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model<IMCPServer>('MCPServer', mcpServerSchema);
