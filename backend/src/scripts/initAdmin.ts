import mongoose from 'mongoose';
import User from '../models/User';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@minichat.com';

export const initAdmin = async () => {
    try {
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
        console.log(`✅ Created admin user: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
    } catch (error) {
        console.error('❌ Failed to init admin:', error);
    }
};
