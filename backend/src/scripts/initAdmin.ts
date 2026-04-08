import mongoose from 'mongoose';
import User from '../models/User';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@minichat.com';

const isProduction = process.env.NODE_ENV === 'production';

// Predefined IDs for system users
export const AI_ASSISTANT_ID = new mongoose.Types.ObjectId('000000000000000000000001');
export const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000002');

const initSystemUsers = async () => {
    const systemUsers = [
        { _id: AI_ASSISTANT_ID, username: 'ai_assistant', role: 'user', provider: 'local' as const },
        { _id: SYSTEM_USER_ID, username: 'system', role: 'user', provider: 'local' as const },
    ];

    for (const userData of systemUsers) {
        const existing = await User.findById(userData._id);
        if (!existing) {
            await User.create(userData);
            console.log(`✅ Created system user: ${userData.username}`);
        }
    }
};

export const initAdmin = async () => {
    // In production, require explicit env vars — no default credentials
    if (isProduction && !process.env.ADMIN_USERNAME && !process.env.ADMIN_PASSWORD) {
        console.error('❌ ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required in production');
        return;
    }

    try {
        // Always initialize system users first
        await initSystemUsers();

        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log(`✅ Admin user exists: ${existingAdmin.username}`);
            return;
        }

        const existingUser = await User.findOne({ username: ADMIN_USERNAME });
        if (existingUser) {
            await User.findByIdAndUpdate(existingUser._id, { role: 'admin' });
            console.log(`✅ Upgraded existing user to admin: ${ADMIN_USERNAME}`);
            return;
        }

        const admin = new User({
            username: ADMIN_USERNAME,
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: 'admin',
            provider: 'local',
        });
        await admin.save();
        console.log(`✅ Created admin user: ${ADMIN_USERNAME}`);
    } catch (error) {
        console.error('❌ Failed to init admin:', error);
    }
};
