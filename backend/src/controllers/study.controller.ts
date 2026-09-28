import { Response } from 'express';
import { Subject, StudyPlan, StudySession } from '../models';
import { AuthRequest } from '../types';
import { AppError, sendSuccess, asyncHandler } from '../utils/helpers';
import { updateDailyAnalytics } from '../services/analytics.service';
import { createAndEmitNotification } from '../services/notification.service';

const parseDate = (dateStr?: string): Date | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
};

// Subjects
export const getSubjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  const subjects = await Subject.find({ userId: req.userId }).sort({ name: 1 });
  sendSuccess(res, subjects);
});

export const createSubject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const subject = await Subject.create({ ...req.body, userId: req.userId });
  sendSuccess(res, subject, 'Subject created', 201);
});

export const updateSubject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const subject = await Subject.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    req.body,
    { new: true }
  );
  if (!subject) throw new AppError('Subject not found', 404);
  sendSuccess(res, subject);
});

export const deleteSubject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const subject = await Subject.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!subject) throw new AppError('Subject not found', 404);
  await StudyPlan.deleteMany({ subjectId: subject._id });
  sendSuccess(res, undefined, 'Subject deleted');
});

// Study Plans
export const getStudyPlans = asyncHandler(async (req: AuthRequest, res: Response) => {
  const plans = await StudyPlan.find({ userId: req.userId })
    .populate('subjectId', 'name color')
    .sort({ deadline: 1 });
  sendSuccess(res, plans);
});

export const createStudyPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const subject = await Subject.findOne({ _id: req.body.subjectId, userId: req.userId });
  if (!subject) throw new AppError('Subject not found', 404);

  const plan = await StudyPlan.create({
    ...req.body,
    userId: req.userId,
    deadline: parseDate(req.body.deadline),
    examDate: parseDate(req.body.examDate),
  });
  sendSuccess(res, plan, 'Study plan created', 201);
});

export const updateStudyPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updates = { ...req.body };
  if (updates.deadline) updates.deadline = parseDate(updates.deadline);
  if (updates.examDate) updates.examDate = parseDate(updates.examDate);

  const plan = await StudyPlan.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    updates,
    { new: true }
  ).populate('subjectId', 'name color');

  if (!plan) throw new AppError('Study plan not found', 404);
  sendSuccess(res, plan);
});

export const deleteStudyPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const plan = await StudyPlan.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!plan) throw new AppError('Study plan not found', 404);
  sendSuccess(res, undefined, 'Study plan deleted');
});

// Study Sessions
export const getStudySessions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { days = '30' } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days as string, 10));

  const sessions = await StudySession.find({
    userId: req.userId,
    startedAt: { $gte: startDate },
  })
    .populate('subjectId', 'name color')
    .sort({ startedAt: -1 });

  sendSuccess(res, sessions);
});

export const createStudySession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await StudySession.create({
    ...req.body,
    userId: req.userId,
    startedAt: parseDate(req.body.startedAt) || new Date(),
    endedAt: parseDate(req.body.endedAt),
  });

  await updateDailyAnalytics(req.userId!);

  // Update study plan progress if session is linked to a plan
  if (session.studyPlanId) {
    const plan = await StudyPlan.findOne({ _id: session.studyPlanId, userId: req.userId });
    if (plan && plan.status !== 'completed') {
      // Increment progress based on session duration (25 min = 10% progress)
      const progressIncrement = Math.min(10, Math.round(session.duration / 2.5));
      plan.progress = Math.min(100, plan.progress + progressIncrement);
      
      // Auto-update status based on progress
      if (plan.progress >= 100) {
        plan.status = 'completed';
      } else if (plan.progress > 0 && plan.status === 'not_started') {
        plan.status = 'in_progress';
      }
      
      await plan.save();
    }
  }

  // Send study session notification
  await createAndEmitNotification(
    req.userId!,
    'study_session',
    'Study Session Recorded',
    `You completed a ${session.type} session for ${session.duration} minutes`,
    '/study',
    { sessionId: session._id },
    req.user?.preferences?.notifications?.email,
    req.user?.email
  );

  sendSuccess(res, session, 'Study session recorded', 201);
});

export const getExamSchedule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exams = await StudyPlan.find({
    userId: req.userId,
    examDate: { $exists: true, $ne: null },
  })
    .populate('subjectId', 'name color')
    .sort({ examDate: 1 });

  sendSuccess(res, exams);
});

export const getStudyProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [plans, sessions, subjects] = await Promise.all([
    StudyPlan.find({ userId: req.userId }),
    StudySession.find({
      userId: req.userId,
      type: { $in: ['study', 'pomodoro'] },
    }),
    Subject.find({ userId: req.userId }),
  ]);

  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  const completedPlans = plans.filter((p) => p.status === 'completed').length;
  const avgProgress =
    plans.length > 0
      ? Math.round(plans.reduce((sum, p) => sum + p.progress, 0) / plans.length)
      : 0;

  const subjectProgress = subjects.map((subject) => {
    const subjectPlans = plans.filter(
      (p) => p.subjectId.toString() === subject._id.toString()
    );
    const subjectSessions = sessions.filter(
      (s) => s.subjectId?.toString() === subject._id.toString()
    );
    return {
      subjectId: subject._id,
      name: subject.name,
      color: subject.color,
      plansCount: subjectPlans.length,
      avgProgress:
        subjectPlans.length > 0
          ? Math.round(
              subjectPlans.reduce((sum, p) => sum + p.progress, 0) / subjectPlans.length
            )
          : 0,
      studyMinutes: subjectSessions.reduce((sum, s) => sum + s.duration, 0),
    };
  });

  sendSuccess(res, {
    totalMinutes,
    totalSessions: sessions.length,
    completedPlans,
    totalPlans: plans.length,
    avgProgress,
    subjectProgress,
  });
});
