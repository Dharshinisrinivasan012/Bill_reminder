import { Task, StudyPlan, Habit, User, Analytics } from '../models';
import { createAndEmitNotification } from './notification.service';
import { sendWeeklySummaryEmail, sendMonthlySummaryEmail } from './email.service';

export const checkDeadlineAlerts = async (): Promise<void> => {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingTasks = await Task.find({
    dueDate: { $gte: now, $lte: in24Hours },
    status: { $ne: 'done' },
  }).populate('userId', 'email preferences');

  for (const task of upcomingTasks) {
    const user = task.userId as unknown as {
      _id: string;
      email: string;
      preferences: { notifications: { email: boolean } };
    };
    if (!user?._id) continue;

    await createAndEmitNotification(
      user._id.toString(),
      'deadline_alert',
      'Deadline Approaching',
      `"${task.title}" is due within 24 hours`,
      `/tasks`,
      { taskId: task._id },
      user.preferences?.notifications?.email,
      user.email
    );
  }

  const upcomingExams = await StudyPlan.find({
    examDate: { $gte: now, $lte: in24Hours },
    status: { $ne: 'completed' },
  }).populate('userId', 'email preferences');

  for (const plan of upcomingExams) {
    const user = plan.userId as unknown as {
      _id: string;
      email: string;
      preferences: { notifications: { email: boolean } };
    };
    if (!user?._id) continue;

    await createAndEmitNotification(
      user._id.toString(),
      'deadline_alert',
      'Exam Approaching',
      `Exam for "${plan.topic}" is within 24 hours`,
      `/study`,
      { studyPlanId: plan._id },
      user.preferences?.notifications?.email,
      user.email
    );
  }
};

export const checkOverdueTasks = async (): Promise<void> => {
  const now = new Date();

  const overdueTasks = await Task.find({
    dueDate: { $lt: now },
    status: { $ne: 'done' },
  }).populate('userId', 'email preferences');

  for (const task of overdueTasks) {
    const user = task.userId as unknown as {
      _id: string;
      email: string;
      preferences: { notifications: { email: boolean } };
    };
    if (!user?._id) continue;

    await createAndEmitNotification(
      user._id.toString(),
      'task_overdue',
      'Task Overdue',
      `"${task.title}" is overdue`,
      `/tasks`,
      { taskId: task._id },
      user.preferences?.notifications?.email,
      user.email
    );
  }
};

export const checkHabitReminders = async (): Promise<void> => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const habits = await Habit.find({ frequency: 'daily' }).populate('userId', 'email preferences');

  for (const habit of habits) {
    const user = habit.userId as unknown as {
      _id: string;
      email: string;
      preferences: { notifications: { email: boolean } };
    };
    if (!user?._id) continue;

    const completedToday = habit.completions.some(
      (c) => new Date(c.date).setHours(0, 0, 0, 0) === now.getTime() && c.count >= habit.targetCount
    );

    if (!completedToday) {
      await createAndEmitNotification(
        user._id.toString(),
        'habit_reminder',
        'Habit Reminder',
        `Don't forget to complete "${habit.name}" today!`,
        `/habits`,
        { habitId: habit._id },
        user.preferences?.notifications?.email,
        user.email
      );
    }
  }
};

export const sendWeeklyReports = async (): Promise<void> => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const users = await User.find({});

  for (const user of users) {
    const analytics = await Analytics.find({
      userId: user._id,
      date: { $gte: weekAgo },
    });

    const stats = {
      tasksCompleted: analytics.reduce((sum, a) => sum + a.tasksCompleted, 0),
      habitsCompleted: analytics.reduce((sum, a) => sum + a.habitsCompleted, 0),
      studyMinutes: analytics.reduce((sum, a) => sum + a.studyMinutes, 0),
    };

    if (user.preferences?.notifications?.email && user.email) {
      await sendWeeklySummaryEmail(user.email, stats);
    }

    await createAndEmitNotification(
      user._id.toString(),
      'weekly_report',
      'Weekly Productivity Report',
      `You completed ${stats.tasksCompleted} tasks, ${stats.habitsCompleted} habits, and studied ${Math.round(stats.studyMinutes / 60)} hours this week.`,
      `/analytics`,
      { stats },
      false,
      undefined
    );
  }
};

export const sendMonthlyReports = async (): Promise<void> => {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const users = await User.find({});

  for (const user of users) {
    const analytics = await Analytics.find({
      userId: user._id,
      date: { $gte: monthAgo },
    });

    const stats = {
      tasksCompleted: analytics.reduce((sum, a) => sum + a.tasksCompleted, 0),
      habitsCompleted: analytics.reduce((sum, a) => sum + a.habitsCompleted, 0),
      studyMinutes: analytics.reduce((sum, a) => sum + a.studyMinutes, 0),
    };

    if (user.preferences?.notifications?.email && user.email) {
      await sendMonthlySummaryEmail(user.email, stats);
    }

    await createAndEmitNotification(
      user._id.toString(),
      'monthly_report',
      'Monthly Productivity Report',
      `You completed ${stats.tasksCompleted} tasks, ${stats.habitsCompleted} habits, and studied ${Math.round(stats.studyMinutes / 60)} hours this month.`,
      `/analytics`,
      { stats },
      false,
      undefined
    );
  }
};

export const startReminderScheduler = (): void => {
  checkDeadlineAlerts();
  checkOverdueTasks();
  checkHabitReminders();
  
  // Run deadline checks every hour
  setInterval(checkDeadlineAlerts, 60 * 60 * 1000);
  setInterval(checkOverdueTasks, 60 * 60 * 1000);
  
  // Run habit reminders every 6 hours
  setInterval(checkHabitReminders, 6 * 60 * 60 * 1000);
  
  // Send weekly reports every Sunday at 9 AM
  const scheduleWeeklyReport = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hours = now.getHours();
    
    if (dayOfWeek === 0 && hours === 9) {
      sendWeeklyReports();
    }
  };
  
  // Send monthly reports on the 1st of each month at 9 AM
  const scheduleMonthlyReport = () => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const hours = now.getHours();
    
    if (dayOfMonth === 1 && hours === 9) {
      sendMonthlyReports();
    }
  };
  
  setInterval(scheduleWeeklyReport, 60 * 60 * 1000);
  setInterval(scheduleMonthlyReport, 60 * 60 * 1000);
};
