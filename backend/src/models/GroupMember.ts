import mongoose, { Document, Schema } from 'mongoose';

export type GroupMemberRole = 'owner' | 'admin' | 'member';

export interface IGroupMember extends Document {
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    role: GroupMemberRole;
    joinedAt: Date;
}

const groupMemberSchema = new Schema<IGroupMember>({
    groupId: {
        type: Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    role: {
        type: String,
        enum: ['owner', 'admin', 'member'],
        default: 'member',
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
});

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
groupMemberSchema.index({ userId: 1, joinedAt: -1 });

export default mongoose.model<IGroupMember>('GroupMember', groupMemberSchema);
