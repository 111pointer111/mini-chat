import { Request, Response } from 'express';
import mongoose from 'mongoose';
import MCPServer from '../models/MCPServer';
import {
    listToolsForServer,
    listUserMcpTools,
    sanitizeMcpServer,
    testMcpServerConnection,
} from '../services/mcpService';

const normalizeTransport = (transport: unknown): 'http' | 'sse' => {
    return transport === 'sse' ? 'sse' : 'http';
};

const normalizeUrl = (url: unknown): string => {
    const value = String(url || '').trim();
    if (!value) {
        throw new Error('MCP server URL is required');
    }

    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('MCP server URL must start with http:// or https://');
    }

    return parsed.toString();
};

const normalizeHeaders = (headers: unknown) => {
    if (!Array.isArray(headers)) return [];

    return headers
        .map((header) => ({
            key: String(header?.key || '').trim(),
            value: String(header?.value || ''),
        }))
        .filter((header) => header.key && header.value);
};

const findOwnedServer = (serverId: string, userId: string) => {
    if (!mongoose.Types.ObjectId.isValid(serverId)) {
        return null;
    }

    return MCPServer.findOne({
        _id: serverId,
        userId: new mongoose.Types.ObjectId(userId),
    });
};

export const getServers = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const servers = await MCPServer.find({ userId: new mongoose.Types.ObjectId(userId) })
            .sort({ enabled: -1, updatedAt: -1 })
            .lean();

        res.json({ servers: servers.map(sanitizeMcpServer) });
    } catch (error) {
        console.error('Get MCP servers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createServer = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { name, description, transport, enabled } = req.body;

        const server = await MCPServer.create({
            userId: new mongoose.Types.ObjectId(userId),
            name: String(name || '').trim(),
            description: description ? String(description).trim() : undefined,
            transport: normalizeTransport(transport),
            url: normalizeUrl(req.body.url),
            headers: normalizeHeaders(req.body.headers),
            enabled: enabled !== false,
        });

        res.status(201).json({ server: sanitizeMcpServer(server.toObject()) });
    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(400).json({ message: 'MCP server name already exists' });
        }
        console.error('Create MCP server error:', error);
        res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid MCP server data' });
    }
};

export const updateServer = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const server = await findOwnedServer(String(req.params.id), userId);
        if (!server) {
            return res.status(404).json({ message: 'MCP server not found' });
        }

        const { name, description, transport, url, headers, enabled } = req.body;
        if (name !== undefined) server.name = String(name).trim();
        if (description !== undefined) server.description = description ? String(description).trim() : undefined;
        if (transport !== undefined) server.transport = normalizeTransport(transport);
        if (url !== undefined) server.url = normalizeUrl(url);
        if (headers !== undefined) server.headers = normalizeHeaders(headers);
        if (enabled !== undefined) server.enabled = enabled !== false;

        await server.save();
        res.json({ server: sanitizeMcpServer(server.toObject()) });
    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(400).json({ message: 'MCP server name already exists' });
        }
        console.error('Update MCP server error:', error);
        res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid MCP server data' });
    }
};

export const deleteServer = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const server = await findOwnedServer(String(req.params.id), userId);
        if (!server) {
            return res.status(404).json({ message: 'MCP server not found' });
        }

        await server.deleteOne();
        res.json({ message: 'MCP server deleted' });
    } catch (error) {
        console.error('Delete MCP server error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const testServer = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const server = await findOwnedServer(String(req.params.id), userId);
        if (!server) {
            return res.status(404).json({ message: 'MCP server not found' });
        }

        const result = await testMcpServerConnection(server);
        res.json(result);
    } catch (error) {
        console.error('Test MCP server error:', error);
        res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
};

export const refreshServerTools = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const server = await findOwnedServer(String(req.params.id), userId);
        if (!server) {
            return res.status(404).json({ message: 'MCP server not found' });
        }

        const tools = await listToolsForServer(server);
        server.cachedTools = tools;
        server.lastConnectedAt = new Date();
        server.lastError = undefined;
        await server.save();

        res.json({ server: sanitizeMcpServer(server.toObject()), tools });
    } catch (error) {
        console.error('Refresh MCP tools error:', error);
        res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
};

export const getTools = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const tools = await listUserMcpTools(userId);
        res.json({ tools });
    } catch (error) {
        console.error('Get MCP tools error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
