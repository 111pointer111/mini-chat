import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    username: string;
    email?: string;
    phone?: string;
    password?: string;
    avatar?: string;
    role: 'user' | 'admin';
    provider: 'local' | 'google' | 'phone';
    googleId?: string;
    isPhoneVerified: boolean;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, sparse: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, sparse: true, unique: true, trim: true },
    password: { type: String, select: false },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    provider: { type: String, enum: ['local', 'google', 'phone'], default: 'local' },
    googleId: { type: String },
    isPhoneVerified: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Hash password before saving
// Async function, no next callback needed
UserSchema.pre('save', async function () {
    const user = this as unknown as IUser;

    // Only hash the password if it has been modified (or is new)
    if (!user.isModified('password') || !user.password) return;

    try {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
    } catch (error) {
        throw error;
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    const user = this as unknown as IUser;
    if (!user.password) return false;
    return bcrypt.compare(candidatePassword, user.password);
};

export default mongoose.model<IUser>('User', UserSchema);
