import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Group from '../models/Group';
import GroupMember from '../models/GroupMember';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import User from '../models/User';
import { clearDocumentExistsCache, deleteDocumentInScope, listDocuments } from '../utils/kbDb';
import { processUploadedFile, processUrlImport } from '../services/kbService';
import { uploadKbFile } from '../services/kbFileService';

async function ensureGroupMember(groupId: string, userId: string) {
    return GroupMember.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        userId: new mongoose.Types.ObjectId(userId),
    });
}

function getParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] : value || '';
}

export const createGroup = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { name, description, memberIds = [] } = req.body;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: '群名称不能为空' });
        }

        const uniqueMemberIds = Array.from(new Set<string>([userId, ...memberIds.map(String)]));
        const existingUsers = await User.find({ _id: { $in: uniqueMemberIds } }).select('_id');
        const existingUserIds = existingUsers.map((user) => user._id.toString());

        const group = await Group.create({
            name: name.trim(),
            description,
            ownerId: new mongoose.Types.ObjectId(userId),
        });

        await GroupMember.insertMany(existingUserIds.map((memberId) => ({
            groupId: group._id,
            userId: new mongoose.Types.ObjectId(memberId),
            role: memberId === userId ? 'owner' : 'member',
        })));

        await Conversation.create({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'group',
            name: group.name,
            groupId: group._id,
            lastMessageAt: new Date(),
        });

        res.status(201).json(group);
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ message: '创建群组失败' });
    }
};

export const listGroups = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const memberships = await GroupMember.find({ userId: new mongoose.Types.ObjectId(userId) })
            .populate('groupId')
            .sort({ joinedAt: -1 })
            .lean();

        const groups = memberships
            .filter((membership) => membership.groupId)
            .map((membership) => ({
                ...(membership.groupId as any),
                role: membership.role,
            }));

        res.json(groups);
    } catch (error) {
        console.error('List groups error:', error);
        res.status(500).json({ message: '获取群组失败' });
    }
};

export const getGroupMembers = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const groupId = getParam(req.params.groupId);
        const membership = await ensureGroupMember(groupId, userId);
        if (!membership) {
            return res.status(403).json({ message: '无权访问该群组' });
        }

        const members = await GroupMember.find({ groupId: new mongoose.Types.ObjectId(groupId) })
            .populate('userId', 'username email avatar')
            .sort({ joinedAt: 1 })
            .lean();

        res.json(members.map((member) => ({
            role: member.role,
            joinedAt: member.joinedAt,
            user: member.userId,
        })));
    } catch (error) {
        console.error('Get group members error:', error);
        res.status(500).json({ message: '获取群成员失败' });
    }
};

export const addGroupMembers = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const groupId = getParam(req.params.groupId);
        const { memberIds = [] } = req.body;

        const membership = await ensureGroupMember(groupId, userId);
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return res.status(403).json({ message: '只有群主或管理员可以添加成员' });
        }

        const existingUsers = await User.find({ _id: { $in: memberIds } }).select('_id');
        const docs = existingUsers.map((user) => ({
            groupId: new mongoose.Types.ObjectId(groupId),
            userId: user._id,
            role: 'member',
        }));

        if (docs.length > 0) {
            await GroupMember.insertMany(docs, { ordered: false }).catch(() => undefined);
        }

        res.json({ message: '添加成功' });
    } catch (error) {
        console.error('Add group members error:', error);
        res.status(500).json({ message: '添加成员失败' });
    }
};

export const getGroupMessages = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const groupId = getParam(req.params.groupId);
        const { before, limit: limitStr } = req.query;
        const limit = Math.min(parseInt(limitStr as string) || 50, 100);
        const membership = await ensureGroupMember(groupId, userId);
        if (!membership) {
            return res.status(403).json({ message: '无权访问该群组' });
        }

        const query: any = { groupId: new mongoose.Types.ObjectId(groupId) };
        if (before) {
            query.createdAt = { $lt: new Date(before as string) };
        }

        const messages = await Message.find(query)
            .populate('sender', 'username avatar')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        messages.reverse();

        res.json({
            messages,
            hasMore: messages.length === limit,
        });
    } catch (error) {
        console.error('Get group messages error:', error);
        res.status(500).json({ message: '获取群消息失败' });
    }
};

export const listGroupDocuments = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const groupId = getParam(req.params.groupId);
        const membership = await ensureGroupMember(groupId, userId);
        if (!membership) {
            return res.status(403).json({ message: '无权访问该群组' });
        }

        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const result = await listDocuments(userId, {
            page,
            pageSize,
            scopeType: 'group',
            scopeId: groupId,
        });

        res.json(result);
    } catch (error) {
        console.error('List group documents error:', error);
        res.status(500).json({ message: '获取群知识库失败' });
    }
};

export const uploadGroupDocument = (req: Request, res: Response) => {
    uploadKbFile(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: '文件上传失败: ' + err.message });
        }
        if (!req.file) {
            return res.status(400).json({ message: '未检测到文件' });
        }

        try {
            const userId = req.user!.id;
            const groupId = getParam(req.params.groupId);
            const membership = await ensureGroupMember(groupId, userId);
            if (!membership) {
                return res.status(403).json({ message: '无权访问该群组' });
            }

            const doc = await processUploadedFile(userId, req.file, req.body.title, {
                type: 'group',
                id: groupId,
            });
            res.status(201).json({ document: doc });
        } catch (error) {
            const msg = error instanceof Error ? error.message : '处理失败';
            res.status(500).json({ message: msg });
        }
    });
};

export const importGroupDocumentFromUrl = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const groupId = getParam(req.params.groupId);
        const { url, title } = req.body;
        const membership = await ensureGroupMember(groupId, userId);
        if (!membership) {
            return res.status(403).json({ message: '无权访问该群组' });
        }
        if (!url) {
            return res.status(400).json({ message: '缺少 url 参数' });
        }

        const doc = await processUrlImport(userId, url, title, {
            type: 'group',
            id: groupId,
        });
        res.status(201).json({ document: doc });
    } catch (error) {
        const msg = error instanceof Error ? error.message : '导入失败';
        res.status(500).json({ message: msg });
    }
};

export const deleteGroupDocument = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const groupId = getParam(req.params.groupId);
        const documentId = getParam(req.params.documentId);
        const membership = await ensureGroupMember(groupId, userId);
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return res.status(403).json({ message: '只有群主或管理员可以删除群知识库文档' });
        }

        const deleted = await deleteDocumentInScope(parseInt(documentId, 10), 'group', groupId);
        if (!deleted) {
            return res.status(404).json({ message: '文档不存在' });
        }
        clearDocumentExistsCache('group', groupId);

        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('Delete group document error:', error);
        res.status(500).json({ message: '删除群知识库文档失败' });
    }
};
