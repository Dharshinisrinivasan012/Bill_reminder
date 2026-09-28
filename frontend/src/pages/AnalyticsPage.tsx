import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsApi } from '@/api';
import { Card, Spinner } from '@/components/ui';
import { useSocket } from '@/hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AnalyticsPage() {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: any) => {
      const relevantTypes = ['task_completed', 'habit_completed', 'study_session', 'weekly_report'];
      if (relevantTypes.includes(notification.type)) {
        queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-habits'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-study'] });
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, queryClient]);
  const { data: productivity, isLoading: pLoading } = useQuery({
    queryKey: ['analytics-productivity'],
    queryFn: () => analyticsApi.getProductivity(30),
  });

  const { data: tasks } = useQuery({
    queryKey: ['analytics-tasks'],
    queryFn: () => analyticsApi.getTasks(30),
  });

  const { data: habits } = useQuery({
    queryKey: ['analytics-habits'],
    queryFn: () => analyticsApi.getHabits(30),
  });

  const { data: study } = useQuery({
    queryKey: ['analytics-study'],
    queryFn: () => analyticsApi.getStudy(30),
  });

  if (pLoading) return <Spinner size="lg" />;

  const productivityData = productivity?.data?.data || [];
  const taskData = tasks?.data?.data;
  const habitData = habits?.data?.data;
  const studyData = study?.data?.data;

  const chartProductivity = productivityData.map((d: { date: string; productivityScore: number }) => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    score: d.productivityScore,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-slate-500">Track your productivity trends</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Productivity Trends (30 days)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartProductivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {taskData && (
          <Card title="Task Distribution">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={taskData.byStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {taskData.byStatus.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <p className="text-sm text-slate-500">
                Completion Rate: <span className="font-bold text-primary-600">{taskData.completionRate}%</span>
              </p>
            </div>
          </Card>
        )}

        {habitData && (
          <Card title="Habit Completion Rate">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={habitData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} name="Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {studyData && (
          <Card title="Study Time Trends">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={studyData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="minutes" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Minutes" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
              <div>
                <p className="text-lg font-bold">{studyData.totalMinutes}</p>
                <p className="text-xs text-slate-500">Total Minutes</p>
              </div>
              <div>
                <p className="text-lg font-bold">{studyData.totalSessions}</p>
                <p className="text-xs text-slate-500">Sessions</p>
              </div>
              <div>
                <p className="text-lg font-bold">{studyData.pomodoroSessions}</p>
                <p className="text-xs text-slate-500">Pomodoros</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
