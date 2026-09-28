import mongoose, { Schema } from 'mongoose';
import { INotification } from '../types';

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'task_reminder',
        'task_created',
        'task_updated',
        'task_completed',
        'task_overdue',
        'deadline_alert',
        'habit_reminder',
        'habit_completed',
        'habit_streak',
        'study_reminder',
        'study_completed',
        'study_session',
        'exam_reminder',
        'weekly_report',
        'monthly_report',
        'system',
        'achievement'
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
    link: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
