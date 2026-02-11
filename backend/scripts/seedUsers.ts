import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import bcrypt from 'bcryptjs';

dotenv.config();

const seedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mini-chat');
        console.log('✅ Connected to MongoDB');

        const users = [
            { username: 'alice', email: 'alice@example.com', password: 'password123' },
            { username: 'bob', email: 'bob@example.com', password: 'password123' },
            { username: 'charlie', email: 'charlie@example.com', password: 'password123' }
        ];

        for (const u of users) {
            const existing = await User.findOne({ email: u.email });
            if (!existing) {
                // Manually hash because our pre-save hook might be tricky in pure script if not instantiated same way
                // Actually our pre-save hook works on instance.save().
                // Let's use User.create which calls save()

                // wait, User.create calls save, so pre hook runs. 
                // BUT, in our updated User.ts, we use async/await and bcrypt.
                // Let's just pass plain password and let the hook handle it.
                await User.create(u);
                console.log(`Created user: ${u.username}`);
            } else {
                console.log(`User already exists: ${u.username}`);
            }
        }

        console.log('✅ Seeding complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

seedUsers();
