import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import mongoose from 'mongoose';
import MCPServer, { IMCPHeader, IMCPServer, IMCPTool } from '../models/MCPServer';

type McpTransport = 'http' | 'sse';

const CLIENT_INFO = {
    name: 'mini-chat-mcp-client',
    version: '1.0.0',
};

const CONNECT_TIMEOUT_MS = 10000;
const TOOL_TIMEOUT_MS = 30000;

const headerListToRecord = (headers: IMCPHeader[] = []) => {
    return headers.reduce<Record<string, string>>((acc, header) => {
        if (header.key && header.value) {
            acc[header.key] = header.value;
        }
        return acc;
    }, {});
};

const createHeaderFetch = (headers: Record<string, string>): typeof fetch => {
    return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        return fetch(input, {
            ...init,
            headers: {
                ...(init?.headers || {}),
                ...headers,
            },
        });
    }) as typeof fetch;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timeout: NodeJS.Timeout | undefined;
    const timer = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms);
    });

    try {
        return await Promise.race([promise, timer]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
};

const createTransport = (server: Pick<IMCPServer, 'url' | 'transport' | 'headers'>): Transport => {
    const url = new URL(server.url);
    const headers = headerListToRecord(server.headers);
    const requestInit = Object.keys(headers).length > 0 ? { headers } : undefined;

    if (server.transport === 'sse') {
        const eventSourceInit = Object.keys(headers).length > 0
            ? { fetch: createHeaderFetch(headers) }
            : undefined;

        return new SSEClientTransport(url, {
            requestInit,
            eventSourceInit,
        });
    }

    return new StreamableHTTPClientTransport(url, {
        requestInit,
    });
};

const connectClient = async (server: Pick<IMCPServer, 'url' | 'transport' | 'headers'>) => {
    const client = new Client(CLIENT_INFO);
    const transport = createTransport(server);

    await withTimeout(
        client.connect(transport),
        CONNECT_TIMEOUT_MS,
        'MCP server connection timed out'
    );

    return { client, transport };
};

const safeToolName = (name: string) => {
    const normalized = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    return normalized || 'tool';
};

const openAIToolName = (serverId: string, toolName: string) => {
    const prefix = `mcp_${serverId.slice(-8)}_`;
    const safe = safeToolName(toolName);
    return `${prefix}${safe}`.slice(0, 64);
};

const normalizeInputSchema = (schema: unknown): Record<string, unknown> => {
    if (typeof schema === 'object' && schema !== null) {
        return schema as Record<string, unknown>;
    }

    return { type: 'object', properties: {} };
};

const normalizeTools = (tools: Array<{ name: string; description?: string; inputSchema?: unknown }>): IMCPTool[] => {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: normalizeInputSchema(tool.inputSchema),
    }));
};

const formatToolResult = (result: unknown): string => {
    if (!result || typeof result !== 'object') {
        return String(result ?? '');
    }

    const typed = result as {
        content?: Array<Record<string, unknown>>;
        structuredContent?: unknown;
        isError?: boolean;
        toolResult?: unknown;
    };

    if ('toolResult' in typed) {
        return typeof typed.toolResult === 'string'
            ? typed.toolResult
            : JSON.stringify(typed.toolResult, null, 2);
    }

    const parts = (typed.content || []).map((item) => {
        if (item.type === 'text') return String(item.text || '');
        if (item.type === 'resource') return JSON.stringify(item.resource, null, 2);
        if (item.type === 'resource_link') return `${String(item.name || item.uri)}: ${String(item.uri)}`;
        if (item.type === 'image') return `[image: ${String(item.mimeType || 'unknown')}]`;
        if (item.type === 'audio') return `[audio: ${String(item.mimeType || 'unknown')}]`;
        return JSON.stringify(item, null, 2);
    }).filter(Boolean);

    if (typed.structuredContent !== undefined) {
        parts.push(JSON.stringify(typed.structuredContent, null, 2));
    }

    const output = parts.join('\n\n').trim();
    return typed.isError ? `MCP 工具返回错误：${output}` : output;
};

export const sanitizeMcpServer = (server: any) => ({
    ...server,
    headers: Array.isArray(server.headers)
        ? server.headers.map((header: IMCPHeader) => ({
            key: header.key,
            hasValue: Boolean(header.value),
        }))
        : [],
});

export const listToolsForServer = async (server: Pick<IMCPServer, 'url' | 'transport' | 'headers'>): Promise<IMCPTool[]> => {
    let transport: Transport | undefined;
    try {
        const connection = await connectClient(server);
        transport = connection.transport;
        const result = await withTimeout(
            connection.client.listTools(),
            CONNECT_TIMEOUT_MS,
            'MCP server listTools timed out'
        );
        return normalizeTools(result.tools);
    } finally {
        await transport?.close().catch(() => undefined);
    }
};

export const testMcpServerConnection = async (server: IMCPServer) => {
    try {
        const tools = await listToolsForServer(server);
        server.cachedTools = tools;
        server.lastConnectedAt = new Date();
        server.lastError = undefined;
        await server.save();

        return {
            success: true,
            toolCount: tools.length,
            tools,
            server: sanitizeMcpServer(server.toObject()),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        server.lastError = message;
        await server.save();
        return {
            success: false,
            error: message,
            toolCount: 0,
            tools: [],
            server: sanitizeMcpServer(server.toObject()),
        };
    }
};

export const listUserMcpTools = async (userId: string) => {
    const servers = await MCPServer.find({
        userId: new mongoose.Types.ObjectId(userId),
        enabled: true,
    })
        .select('name cachedTools enabled lastError lastConnectedAt')
        .lean();

    return servers.flatMap((server) =>
        (server.cachedTools || []).map((tool) => ({
            serverId: String(server._id),
            serverName: server.name,
            name: tool.name,
            openAIToolName: openAIToolName(String(server._id), tool.name),
            description: tool.description,
            inputSchema: tool.inputSchema,
        }))
    );
};

export const getMcpToolDefinitions = async (userId: string) => {
    const tools = await listUserMcpTools(userId);

    return tools.map((tool) => ({
        type: 'function' as const,
        function: {
            name: tool.openAIToolName,
            description: `[MCP: ${tool.serverName}] ${tool.description || tool.name}`,
            parameters: normalizeInputSchema(tool.inputSchema),
        },
    }));
};

export const executeMcpTool = async (
    userId: string,
    openAIToolNameValue: string,
    args: Record<string, unknown>
): Promise<string> => {
    const servers = await MCPServer.find({
        userId: new mongoose.Types.ObjectId(userId),
        enabled: true,
    });

    for (const server of servers) {
        const match = server.cachedTools.find((tool) => openAIToolName(String(server._id), tool.name) === openAIToolNameValue);
        if (!match) continue;

        let transport: Transport | undefined;
        try {
            const connection = await connectClient(server);
            transport = connection.transport;
            const result = await withTimeout(
                connection.client.callTool({
                    name: match.name,
                    arguments: args,
                }),
                TOOL_TIMEOUT_MS,
                'MCP tool call timed out'
            );

            return formatToolResult(result) || 'MCP 工具执行完成，但没有返回内容。';
        } finally {
            await transport?.close().catch(() => undefined);
        }
    }

    return `错误：未找到 MCP 工具 "${openAIToolNameValue}"`;
};
