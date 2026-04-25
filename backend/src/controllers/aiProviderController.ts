import { Request, Response } from 'express';
import AIProvider from '../models/AIProvider';
import User from '../models/User';

const normalizeEmbeddingDimensions = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }

    return parsed;
};

// Get all enabled AI providers (for users)
export const getProviders = async (req: Request, res: Response) => {
    try {
        const providers = await AIProvider.find({ enabled: true })
            .select('name modelName isDefault')
            .sort({ isDefault: -1, name: 1 });

        res.json(providers);
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get user's selected provider
export const getUserProvider = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await User.findById(userId).populate('selectedAIProvider', 'name modelName');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user has no selected provider, return default
        if (!user.selectedAIProvider) {
            const defaultProvider = await AIProvider.findOne({ isDefault: true, enabled: true })
                .select('name modelName');
            return res.json({ provider: defaultProvider });
        }

        res.json({ provider: user.selectedAIProvider });
    } catch (error) {
        console.error('Get user provider error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Set user's selected provider
export const setUserProvider = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { providerId } = req.body;

        // Verify provider exists and is enabled
        const provider = await AIProvider.findOne({ _id: providerId, enabled: true });
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found or disabled' });
        }

        await User.findByIdAndUpdate(userId, { selectedAIProvider: providerId });

        res.json({ message: 'Provider updated', provider: { name: provider.name, modelName: provider.modelName } });
    } catch (error) {
        console.error('Set user provider error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Create provider
export const createProvider = async (req: Request, res: Response) => {
    try {
        const { name, baseURL, apiKey, modelName, embeddingModel, embeddingBaseURL, embeddingDimensions, groupId, enabled, isDefault } = req.body;

        // If setting as default, unset other defaults
        if (isDefault) {
            await AIProvider.updateMany({}, { isDefault: false });
        }

        const provider = await AIProvider.create({
            name,
            baseURL,
            apiKey,
            modelName,
            embeddingModel,
            embeddingBaseURL,
            embeddingDimensions: normalizeEmbeddingDimensions(embeddingDimensions),
            groupId,
            enabled: enabled !== false,
            isDefault: isDefault || false,
        });

        res.status(201).json(provider);
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Provider name already exists' });
        }
        console.error('Create provider error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Update provider
export const updateProvider = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, baseURL, apiKey, modelName, embeddingModel, embeddingBaseURL, embeddingDimensions, groupId, enabled, isDefault } = req.body;

        // If setting as default, unset other defaults
        if (isDefault) {
            await AIProvider.updateMany({ _id: { $ne: id } } as any, { isDefault: false });
        }

        const updateData: Record<string, unknown> = {
            name,
            baseURL,
            modelName,
            embeddingModel,
            embeddingBaseURL,
            embeddingDimensions: normalizeEmbeddingDimensions(embeddingDimensions),
            groupId,
            enabled,
            isDefault,
        };

        // 只在提供了新 API Key 时才更新
        if (apiKey) {
            updateData.apiKey = apiKey;
        }

        const provider = await AIProvider.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        res.json(provider);
    } catch (error) {
        console.error('Update provider error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Delete provider
export const deleteProvider = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const provider = await AIProvider.findByIdAndDelete(id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        // Clear users' selection if they had this provider
        await User.updateMany({ selectedAIProvider: id }, { $unset: { selectedAIProvider: 1 } });

        res.json({ message: 'Provider deleted' });
    } catch (error) {
        console.error('Delete provider error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: Get all providers (including disabled)
export const getAllProviders = async (req: Request, res: Response) => {
    try {
        const providers = await AIProvider.find()
            .select('-apiKey')
            .sort({ isDefault: -1, name: 1 });

        res.json(providers);
    } catch (error) {
        console.error('Get all providers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
