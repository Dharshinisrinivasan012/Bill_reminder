import { Response } from 'express';
import { Task } from '../models';
import { AuthRequest } from '../types';
import { AppError, sendSuccess, asyncHandler } from '../utils/helpers';
import { updateDailyAnalytics } from '../services/analytics.service';
import { createAndEmitNotification } from '../services/notification.service';

const parseDate = (dateStr?: string): Date | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
};

export const getTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    status,
    priority,
    category,
    tag,
    search,
    sort = 'createdAt',
    order = 'desc',
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = { userId: req.userId };

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (search) {
    filter.$text = { $search: search };
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const sortOrder = order === 'asc' ? 1 : -1;
  const sortField = ['createdAt', 'dueDate', 'priority', 'title', 'kanbanOrder'].includes(sort)
    ? sort
    : 'createdAt';

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limitNum),
    Task.countDocuments(filter),
  ]);

  sendSuccess(res, {
    data: tasks,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

export const getTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
  if (!task) throw new AppError('Task not found', 404);
  sendSuccess(res, task);
});

export const createTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const taskData = {
    ...req.body,
    userId: req.userId,
    dueDate: parseDate(req.body.dueDate),
    reminder: parseDate(req.body.reminder),
    recurrenceEndDate: parseDate(req.body.recurrenceEndDate),
    scheduledStart: parseDate(req.body.scheduledStart),
    scheduledEnd: parseDate(req.body.scheduledEnd),
  };

  const task = await Task.create(taskData);
  await updateDailyAnalytics(req.userId!);
  
  // Create notification for new task
  await createAndEmitNotification(
    req.userId!,
    'task_created',
    'New Task Created',
    `Task "${task.title}" has been created`,
    `/tasks/${task._id}`,
    { taskId: task._id },
    req.user?.preferences?.notifications?.email,
    req.user?.email
  );
  
  sendSuccess(res, task, 'Task created', 201);
});

export const updateTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
  if (!task) throw new AppError('Task not found', 404);

  const updates = { ...req.body };
  if (updates.dueDate) updates.dueDate = parseDate(updates.dueDate);
  if (updates.reminder) updates.reminder = parseDate(updates.reminder);
  if (updates.recurrenceEndDate) updates.recurrenceEndDate = parseDate(updates.recurrenceEndDate);
  if (updates.scheduledStart) updates.scheduledStart = parseDate(updates.scheduledStart);
  if (updates.scheduledEnd) updates.scheduledEnd = parseDate(updates.scheduledEnd);

  const wasNotDone = task.status !== 'done';
  const isNowDone = updates.status === 'done';

  if (isNowDone && wasNotDone) {
    updates.completedAt = new Date();
  }

  Object.assign(task, updates);
  await task.save();
  await updateDailyAnalytics(req.userId!);

  // Send task updated notification (only if not just completing)
  if (!(isNowDone && wasNotDone)) {
    await createAndEmitNotification(
      req.userId!,
      'task_updated',
      'Task Updated',
      `Task "${task.title}" has been updated`,
      `/tasks/${task._id}`,
      { taskId: task._id },
      false,
      undefined
    );
  }

  // Create notification when task is completed
  if (isNowDone && wasNotDone) {
    await createAndEmitNotification(
      req.userId!,
      'task_completed',
      'Task Completed',
      `Task "${task.title}" has been completed`,
      `/tasks/${task._id}`,
      { taskId: task._id },
      req.user?.preferences?.notifications?.email,
      req.user?.email
    );
  }

  sendSuccess(res, task, 'Task updated');
});

export const deleteTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!task) throw new AppError('Task not found', 404);
  sendSuccess(res, undefined, 'Task deleted');
});

export const getKanbanBoard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await Task.find({ userId: req.userId }).sort({ kanbanOrder: 1 });

  const board = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    review: tasks.filter((t) => t.status === 'review'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  sendSuccess(res, board);
});

export const updateKanbanOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { taskId, status, order } = req.body;

  const task = await Task.findOne({ _id: taskId, userId: req.userId });
  if (!task) throw new AppError('Task not found', 404);

  task.status = status;
  task.kanbanOrder = order;
  if (status === 'done' && !task.completedAt) {
    task.completedAt = new Date();
  }
  await task.save();
  await updateDailyAnalytics(req.userId!);

  sendSuccess(res, task);
});

export const getCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
  const categories = await Task.distinct('category', {
    userId: req.userId,
    category: { $nin: [null, ''] },
  });
  sendSuccess(res, categories);
});

export const getTags = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tags = await Task.distinct('tags', { userId: req.userId });
  sendSuccess(res, tags);
});

export const checkReminders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const upcoming = await Task.find({
    userId: req.userId,
    reminder: { $lte: now, $gte: new Date(now.getTime() - 5 * 60 * 1000) },
    status: { $ne: 'done' },
  });

  for (const task of upcoming) {
    await createAndEmitNotification(
      req.userId!,
      'task_reminder',
      'Task Reminder',
      `Reminder: ${task.title}`,
      `/tasks/${task._id}`,
      { taskId: task._id },
      req.user?.preferences.notifications.email,
      req.user?.email
    );
  }

  sendSuccess(res, { remindersSent: upcoming.length });
});
