import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      browser: boolean;
      realtime: boolean;
    };
    pomodoro: {
      workMinutes: number;
      breakMinutes: number;
      longBreakMinutes: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ITask extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  category?: string;
  dueDate?: Date;
  reminder?: Date;
  recurrence: RecurrenceType;
  recurrenceEndDate?: Date;
  kanbanOrder: number;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHabit extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetCount: number;
  completions: {
    date: Date;
    count: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubject extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  color: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudyPlan extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  subjectId: Types.ObjectId;
  topic: string;
  description?: string;
  deadline?: Date;
  examDate?: Date;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudySession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  subjectId?: Types.ObjectId;
  studyPlanId?: Types.ObjectId;
  type: 'study' | 'pomodoro' | 'break';
  duration: number;
  notes?: string;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType =
  | 'task_reminder'
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_overdue'
  | 'deadline_alert'
  | 'habit_reminder'
  | 'habit_completed'
  | 'habit_streak'
  | 'study_reminder'
  | 'study_completed'
  | 'study_session'
  | 'exam_reminder'
  | 'weekly_report'
  | 'monthly_report'
  | 'system'
  | 'achievement';

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnalytics extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
  tasksCompleted: number;
  tasksCreated: number;
  habitsCompleted: number;
  studyMinutes: number;
  productivityScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
