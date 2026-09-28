import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(8).max(128),
  }),
  params: z.object({
    token: z.string().min(1),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        notifications: z
          .object({
            email: z.boolean().optional(),
            browser: z.boolean().optional(),
            realtime: z.boolean().optional(),
          })
          .optional(),
        pomodoro: z
          .object({
            workMinutes: z.number().min(1).max(120).optional(),
            breakMinutes: z.number().min(1).max(60).optional(),
            longBreakMinutes: z.number().min(1).max(60).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().max(100).optional(),
    dueDate: z.string().datetime().optional().or(z.string().optional()),
    reminder: z.string().datetime().optional().or(z.string().optional()),
    recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
    recurrenceEndDate: z.string().datetime().optional().or(z.string().optional()),
    kanbanOrder: z.number().optional(),
    scheduledStart: z.string().datetime().optional().or(z.string().optional()),
    scheduledEnd: z.string().datetime().optional().or(z.string().optional()),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().max(100).optional(),
    dueDate: z.string().datetime().optional().or(z.string().optional()),
    reminder: z.string().datetime().optional().or(z.string().optional()),
    recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
    recurrenceEndDate: z.string().datetime().optional().or(z.string().optional()),
    kanbanOrder: z.number().optional(),
    scheduledStart: z.string().datetime().optional().or(z.string().optional()),
    scheduledEnd: z.string().datetime().optional().or(z.string().optional()),
  }),
});

export const createHabitSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    targetCount: z.number().min(1).optional(),
  }),
});

export const trackHabitSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    date: z.string().optional(),
    count: z.number().min(1).optional(),
  }),
});

export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    color: z.string().optional(),
    description: z.string().max(500).optional(),
  }),
});

export const createStudyPlanSchema = z.object({
  body: z.object({
    subjectId: z.string().min(1),
    topic: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    deadline: z.string().optional(),
    examDate: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
    status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  }),
});

export const createStudySessionSchema = z.object({
  body: z.object({
    subjectId: z.string().optional(),
    studyPlanId: z.string().optional(),
    type: z.enum(['study', 'pomodoro', 'break']).optional(),
    duration: z.number().min(0),
    notes: z.string().max(1000).optional(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
  }),
});

export const scheduleTaskSchema = z.object({
  body: z.object({
    taskId: z.string().min(1),
    scheduledStart: z.string(),
    scheduledEnd: z.string(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
