import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Plus, Flame, Check, Trash2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { habitsApi } from '@/api/habits';
import { Button, Input, Textarea, Modal, ProgressBar, EmptyState, Spinner } from '@/components/ui';
import { useSocket } from '@/hooks/useSocket';
import type { Habit } from '@/types';

export function HabitsPage() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: any) => {
      const relevantTypes = ['habit_completed', 'habit_streak'];
      if (relevantTypes.includes(notification.type)) {
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['habit-analytics'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: () => habitsApi.getAll(),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['habit-analytics'],
    queryFn: () => habitsApi.getAnalytics(30),
  });

  const { data: trendsData } = useQuery({
    queryKey: ['habit-trends'],
    queryFn: () => habitsApi.getTrends(30),
  });

  const createMutation = useMutation({
    mutationFn: habitsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['habit-analytics'] });
      setShowModal(false);
    },
  });

  const trackMutation = useMutation({
    mutationFn: (id: string) => habitsApi.track(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-habits'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: habitsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const habits = data?.data?.data || [];
  const analytics = analyticsData?.data?.data || [];
  const trends = trendsData?.data?.data || [];

  const isCompletedToday = (habit: Habit) => {
    const today = new Date().setHours(0, 0, 0, 0);
    return habit.completions.some(
      (c) => new Date(c.date).setHours(0, 0, 0, 0) === today && c.count >= habit.targetCount
    );
  };

  const getStreak = (habitId: string) => {
    const habitAnalytics = analytics.find((a: { habitId: string }) => a.habitId === habitId);
    return habitAnalytics?.streaks?.daily || 0;
  };

  if (isLoading) return <Spinner size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Habit Tracker</h1>
          <p className="text-slate-500">Build consistency with daily habits</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> New Habit
        </Button>
      </div>

      {habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Start tracking your daily habits"
          action={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Create Habit</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {habits.map((habit) => {
            const completed = isCompletedToday(habit);
            const streak = getStreak(habit._id);

            return (
              <motion.div
                key={habit._id}
                layout
                className="card p-5"
                style={{ borderTopColor: habit.color, borderTopWidth: 3 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{habit.name}</h3>
                    {habit.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{habit.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(habit._id)}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">{streak} day streak</span>
                </div>

                <button
                  onClick={() => !completed && trackMutation.mutate(habit._id)}
                  disabled={completed}
                  className={`w-full py-3 rounded-lg font-medium transition-all ${
                    completed
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-slate-100 hover:bg-primary-50 text-slate-700 dark:bg-slate-800 dark:hover:bg-primary-950'
                  }`}
                >
                  {completed ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> Completed Today
                    </span>
                  ) : (
                    'Mark Complete'
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Analytics Chart */}
      {trends.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">30-Day Completion Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completions" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <HabitModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />
    </div>
  );
}

function HabitModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Habit>) => void;
  loading: boolean;
}) {
  const { register, handleSubmit } = useForm<{
    name: string;
    description: string;
    color: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    targetCount: number;
  }>({
    defaultValues: { name: '', description: '', color: '#6366f1', frequency: 'daily', targetCount: 1 },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Habit">
      <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
        <Input label="Habit Name" {...register('name', { required: true })} />
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
