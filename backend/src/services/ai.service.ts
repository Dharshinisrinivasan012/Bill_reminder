import OpenAI from 'openai';
import { config } from '../config';
import { ITask } from '../types';
const getClient = (): OpenAI | null => {
  if (!config.openaiApiKey) return null;
  return new OpenAI({ apiKey: config.openaiApiKey });
};
export const prioritizeTasks = async (
  tasks: ITask[]
): Promise<{
  taskId: string;
  title: string;
  priority: string;
  status: string;
  dueDate?: string;
  timeRemaining?: string;
  reason: string;
  action: string;
  section: 'urgent' | 'high' | 'upcoming' | 'completed';
}[]> => {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const threeDays = 3 * oneDay;
  const formatTimeRemaining = (ms: number): string => {
    if (ms < 0) return 'Overdue';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days > 0) return `${days}d ${remainingHours}h`;
    if (hours > 0) return `${hours}h`;
    const minutes = Math.floor(ms / (1000 * 60));
    return `${minutes}m`;
  };
  const getSection = (task: ITask, daysUntilDue: number): 'urgent' | 'high' | 'upcoming' | 'completed' => {
    if (task.status === 'done') return 'completed';
    if (daysUntilDue < 0) return 'urgent';
    if (daysUntilDue <= 1) return 'urgent';
    if (daysUntilDue <= 3) return 'high';
    return 'upcoming';
  };
  const getRecommendedAction = (priority: string, daysUntilDue: number): string => {
    if (daysUntilDue < 0) return 'Complete immediately - overdue';
    if (daysUntilDue <= 1) return 'Complete today - urgent deadline';
    if (daysUntilDue <= 3) return 'Start today - approaching deadline';
    if (priority === 'urgent') return 'Complete immediately';
    if (priority === 'high') return 'Start today';
    if (priority === 'medium') return 'Schedule study session';
    return 'Plan for later';
  };
  const client = getClient();
  if (!client) {
    // Rule-based fallback with detailed information
    const prioritized = tasks.map((task) => {
      const daysUntilDue = task.dueDate
        ? (new Date(task.dueDate).getTime() - now.getTime()) / oneDay
        : Infinity;
      let priority: string;
      let reason: string;
      const currentPriority = task.priority;
      const isUrgentDeadline = daysUntilDue <= 1;
      const isNearDeadline = daysUntilDue <= 3;
      const isOverdue = daysUntilDue < 0;
      if (task.status === 'done') {
        priority = 'completed';
        reason = 'Task has been completed';
      } else if (isOverdue) {
        priority = 'urgent';
        reason = `Overdue by ${Math.abs(Math.floor(daysUntilDue))} days`;
      } else if (currentPriority === 'urgent' || (currentPriority === 'high' && isUrgentDeadline)) {
        priority = 'urgent';
        reason = isUrgentDeadline
          ? `Due within 24 hours`
          : 'Marked as urgent priority';
      } else if (currentPriority === 'high' || (currentPriority === 'medium' && isUrgentDeadline)) {
        priority = 'high';
        reason = isUrgentDeadline
          ? `Due within 24 hours`
          : 'Marked as high priority';
      } else if (currentPriority === 'medium' || (daysUntilDue <= 3 && daysUntilDue > 1)) {
        priority = 'medium';
        reason = isNearDeadline
          ? `Due in ${Math.floor(daysUntilDue)} days`
          : 'Marked as medium priority';
      } else {
        priority = 'low';
        reason = 'No immediate deadline';
      }
      const section = getSection(task, daysUntilDue);
      const timeRemaining = task.dueDate ? formatTimeRemaining(new Date(task.dueDate).getTime() - now.getTime()) : undefined;
      const action = getRecommendedAction(priority, daysUntilDue);
      return {
        taskId: task._id.toString(),
        title: task.title,
        priority,
        status: task.status,
        dueDate: task.dueDate?.toISOString(),
        timeRemaining,
        reason,
        action,
        section,
      };
    });

      return prioritized.sort((a, b) => {
      if (a.section === 'completed' && b.section !== 'completed') return 1;
      if (b.section === 'completed' && a.section !== 'completed') return -1;
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aTime - bTime;
    });
  }
  // OpenAI integration with detailed response
  const taskList = tasks.map((t) => ({
    id: t._id.toString(),
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString(),
    status: t.status,
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a productivity assistant. Analyze tasks and return JSON array with objects containing: taskId, title, priority (low/medium/high/urgent), dueDate, timeRemaining (formatted string), reason, action (recommended action), and section (urgent/high/upcoming/completed). Sort by urgency: overdue, due today, due within 24h, due within 3 days, remaining. Return only valid JSON.',
      },
      {
        role: 'user',
        content: `Prioritize these tasks: ${JSON.stringify(taskList)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const aiTasks = parsed.tasks || parsed.priorities || [];
    
    // Ensure all required fields are present
    return aiTasks.map((t: any) => ({
      taskId: t.taskId,
      title: t.title || tasks.find(task => task._id.toString() === t.taskId)?.title || 'Unknown',
      priority: t.priority || 'medium',
      status: t.status || tasks.find(task => task._id.toString() === t.taskId)?.status || 'todo',
      dueDate: t.dueDate,
      timeRemaining: t.timeRemaining,
      reason: t.reason || 'AI prioritized',
      action: t.action || 'Review task',
      section: t.section || 'upcoming',
    }));
  } catch {
    // Fallback to rule-based if AI fails
    return tasks.map((task) => {
      const daysUntilDue = task.dueDate
        ? (new Date(task.dueDate).getTime() - now.getTime()) / oneDay
        : Infinity;
      const section = getSection(task, daysUntilDue);
      const timeRemaining = task.dueDate ? formatTimeRemaining(new Date(task.dueDate).getTime() - now.getTime()) : undefined;
      
      return {
        taskId: task._id.toString(),
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate?.toISOString(),
        timeRemaining,
        reason: 'Could not parse AI response - using original priority',
        action: getRecommendedAction(task.priority, daysUntilDue),
        section,
      };
    }).sort((a, b) => {
      if (a.section === 'completed' && b.section !== 'completed') return 1;
      if (b.section === 'completed' && a.section !== 'completed') return -1;
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aTime - bTime;
    });
  }
};

export const getStudyRecommendations = async (
  subjects: { name: string; progress: number; deadline?: string }[]
): Promise<{ subject: string; recommendation: string; priority: number }[]> => {
  const client = getClient();
  if (!client) {
    return subjects.map((s) => ({
      subject: s.name,
      recommendation: `Focus on ${s.name} - current progress is ${s.progress}%`,
      priority: 100 - s.progress,
    }));
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a study coach. Return JSON with recommendations array containing subject, recommendation, and priority (1-100). Return only valid JSON.',
      },
      {
        role: 'user',
        content: `Provide study recommendations for: ${JSON.stringify(subjects)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return parsed.recommendations || [];
  } catch {
    return subjects.map((s) => ({
      subject: s.name,
      recommendation: `Review ${s.name} materials`,
      priority: 50,
    }));
  }
};

export const generateWeeklyGoals = async (
  stats: {
    tasksCompleted: number;
    habitsCompleted: number;
    studyMinutes: number;
  }
): Promise<{ goals: string[]; tips: string[] }> => {
  const client = getClient();
  if (!client) {
    return {
      goals: [
        'Complete 10 tasks this week',
        'Maintain daily habit streak',
        'Study for at least 300 minutes',
      ],
      tips: [
        'Break large tasks into smaller subtasks',
        'Schedule study sessions in the morning',
        'Review progress every Sunday',
      ],
    };
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a productivity coach. Return JSON with goals (array of strings) and tips (array of strings). Return only valid JSON.',
      },
      {
        role: 'user',
        content: `Generate weekly goals based on last week stats: ${JSON.stringify(stats)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch {
    return {
      goals: ['Set 3 achievable goals for this week'],
      tips: ['Track your progress daily'],
    };
  }
};
