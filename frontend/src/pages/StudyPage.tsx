import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Plus, Play, Pause, RotateCcw, BookOpen, Clock, Trash2 } from 'lucide-react';
import { studyApi } from '@/api/study';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useAuthStore } from '@/store';
import { useSocket } from '@/hooks/useSocket';
import { Button, Input, Textarea, Select, Modal, Card, ProgressBar, EmptyState, Spinner, Badge } from '@/components/ui';
import { formatDate, formatTime } from '@/utils';
import type { Subject, StudyPlan } from '@/types';

export function StudyPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'subjects' | 'pomodoro'>('plans');
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: any) => {
      const relevantTypes = ['study_session', 'exam_reminder'];
      if (relevantTypes.includes(notification.type)) {
        queryClient.invalidateQueries({ queryKey: ['study-plans'] });
        queryClient.invalidateQueries({ queryKey: ['study-progress'] });
        queryClient.invalidateQueries({ queryKey: ['exams'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, queryClient]);

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => studyApi.getSubjects(),
  });

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['study-plans'],
    queryFn: () => studyApi.getPlans(),
  });

  const { data: progressData } = useQuery({
    queryKey: ['study-progress'],
    queryFn: () => studyApi.getProgress(),
  });

  const { data: examsData } = useQuery({
    queryKey: ['exams'],
    queryFn: () => studyApi.getExams(),
  });

  const createSubjectMutation = useMutation({
    mutationFn: studyApi.createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowSubjectModal(false);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: studyApi.createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowPlanModal(false);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StudyPlan> }) => studyApi.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: studyApi.deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: (data: any) => studyApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-progress'] });
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-study'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
    },
  });

  const subjects = subjectsData?.data?.data || [];
  const plans = plansData?.data?.data || [];
  const progress = progressData?.data?.data;
  const exams = examsData?.data?.data || [];

  const tabs = [
    { id: 'plans' as const, label: 'Study Plans' },
    { id: 'subjects' as const, label: 'Subjects' },
    { id: 'pomodoro' as const, label: 'Pomodoro' },
  ];

  if (isLoading) return <Spinner size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Planner</h1>
          <p className="text-slate-500">Organize your learning journey</p>
        </div>
      </div>

      {/* Stats */}
      {progress && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{formatTime(progress.totalMinutes)}</p>
            <p className="text-xs text-slate-500">Total Study Time</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{progress.totalSessions}</p>
            <p className="text-xs text-slate-500">Sessions</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{progress.completedPlans}/{progress.totalPlans}</p>
            <p className="text-xs text-slate-500">Plans Completed</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{progress.avgProgress}%</p>
            <p className="text-xs text-slate-500">Avg Progress</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowPlanModal(true)} disabled={subjects.length === 0}>
              <Plus className="w-4 h-4" /> New Plan
            </Button>
          </div>
          {plans.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-12 h-12" />}
              title="No study plans"
              description="Create subjects first, then add study plans"
            />
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <motion.div key={plan._id} layout className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{plan.topic}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(plan.subjectId as Subject)?.name || 'Unknown Subject'}
                      </p>
                      {plan.deadline && (
                        <p className="text-xs text-slate-400 mt-1">Due: {formatDate(plan.deadline)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={plan.status === 'completed' ? 'success' : plan.status === 'in_progress' ? 'info' : 'default'}>
                        {plan.status.replace('_', ' ')}
                      </Badge>
                      <button onClick={() => deletePlanMutation.mutate(plan._id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar
                      value={plan.progress}
                      showLabel
                      color="bg-purple-500"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={plan.progress}
                      onChange={(e) => updatePlanMutation.mutate({ id: plan._id, data: { progress: parseInt(e.target.value) } })}
                      className="w-full mt-2"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {exams.length > 0 && (
            <Card title="Upcoming Exams">
              <div className="space-y-2">
                {exams.map((exam) => (
                  <div key={exam._id} className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className="text-sm font-medium">{exam.topic}</span>
                    <span className="text-xs text-slate-500">{formatDate(exam.examDate)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowSubjectModal(true)}>
              <Plus className="w-4 h-4" /> New Subject
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => (
              <div key={subject._id} className="card p-4" style={{ borderLeftColor: subject.color, borderLeftWidth: 4 }}>
                <h3 className="font-semibold">{subject.name}</h3>
                {subject.description && <p className="text-xs text-slate-500 mt-1">{subject.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'pomodoro' && <PomodoroTimer subjects={subjects} />}

      <SubjectModal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        onSubmit={(data) => createSubjectMutation.mutate(data)}
        loading={createSubjectMutation.isPending}
      />
      <PlanModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        subjects={subjects}
        onSubmit={(data) => createPlanMutation.mutate(data)}
        loading={createPlanMutation.isPending}
      />
    </div>
  );
}

function PomodoroTimer({ subjects }: { subjects: Subject[] }) {
  const { user } = useAuthStore();
  const pomodoro = usePomodoro();
  const workMinutes = user?.preferences?.pomodoro?.workMinutes || 25;
  const breakMinutes = user?.preferences?.pomodoro?.breakMinutes || 5;
  const queryClient = useQueryClient();

  const completeSessionMutation = useMutation({
    mutationFn: (data: any) => studyApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-progress'] });
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-study'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
    },
  });

  const minutes = Math.floor(pomodoro.timeLeft / 60);
  const seconds = pomodoro.timeLeft % 60;

  useEffect(() => {
    if (pomodoro.timeLeft === 0 && pomodoro.isRunning) {
      if (pomodoro.isBreak) {
        pomodoro.reset(workMinutes);
      } else {
        pomodoro.completeSession();
        completeSessionMutation.mutate({
          subjectId: pomodoro.subjectId,
          studyPlanId: pomodoro.studyPlanId,
          type: 'pomodoro',
          duration: pomodoro.initialWorkMinutes,
          startedAt: new Date(Date.now() - pomodoro.initialWorkMinutes * 60000).toISOString(),
          endedAt: new Date().toISOString(),
        });
        pomodoro.startBreak(breakMinutes);
      }
    }
  }, [pomodoro.timeLeft, pomodoro.isRunning, pomodoro, workMinutes, breakMinutes, completeSessionMutation]);

  const progress = pomodoro.isBreak
    ? ((breakMinutes * 60 - pomodoro.timeLeft) / (breakMinutes * 60)) * 100
    : ((workMinutes * 60 - pomodoro.timeLeft) / (workMinutes * 60)) * 100;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-64 h-64">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="4" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={pomodoro.isBreak ? '#10b981' : '#6366f1'}
            strokeWidth="4"
            strokeDasharray={`${progress * 2.83} 283`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs text-slate-500 mb-1">{pomodoro.isBreak ? 'Break Time' : 'Focus Time'}</p>
          <p className="text-4xl font-bold tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-xs text-slate-400 mt-1">{pomodoro.sessionsCompleted} sessions completed</p>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        {!pomodoro.isRunning ? (
          <Button size="lg" onClick={() => pomodoro.isBreak ? pomodoro.startBreak(breakMinutes) : pomodoro.start(workMinutes)}>
            <Play className="w-5 h-5" /> Start
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={() => pomodoro.pause()}>
            <Pause className="w-5 h-5" /> Pause
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={() => pomodoro.reset(workMinutes)}>
          <RotateCcw className="w-5 h-5" /> Reset
        </Button>
      </div>
    </div>
  );
}

function SubjectModal({ isOpen, onClose, onSubmit, loading }: { isOpen: boolean; onClose: () => void; onSubmit: (data: Partial<Subject>) => void; loading: boolean }) {
  const { register, handleSubmit } = useForm({ defaultValues: { name: '', color: '#8b5cf6', description: '' } });
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Subject">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Subject Name" {...register('name', { required: true })} />
        <Textarea label="Description" {...register('description')} />
        <Input label="Color" type="color" {...register('color')} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

function PlanModal({ isOpen, onClose, subjects, onSubmit, loading }: { isOpen: boolean; onClose: () => void; subjects: Subject[]; onSubmit: (data: Partial<StudyPlan> & { subjectId: string }) => void; loading: boolean }) {
  const { register, handleSubmit } = useForm<Partial<StudyPlan> & { subjectId: string }>();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Study Plan" size="lg">
      <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
        <Select
          label="Subject"
          options={subjects.map((s) => ({ value: s._id, label: s.name }))}
          {...register('subjectId', { required: true })}
        />
        <Input label="Topic" {...register('topic', { required: true })} />
        <Textarea label="Description" {...register('description')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Deadline" type="date" {...register('deadline')} />
          <Input label="Exam Date" type="date" {...register('examDate')} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
