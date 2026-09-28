import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles, Target, BookOpen, Calendar, Clock, AlertCircle } from 'lucide-react';
import { aiApi } from '@/api';
import { Button, Card, Spinner, Badge } from '@/components/ui';
import { formatDate } from '@/utils';

type PrioritizedTask = {
  taskId: string;
  title: string;
  priority: string;
  status: string;
  dueDate?: string;
  timeRemaining?: string;
  reason: string;
  action: string;
  section: 'urgent' | 'high' | 'upcoming' | 'completed';
};

export function AIPage() {
  const [priorities, setPriorities] = useState<PrioritizedTask[]>([]);
  const [recommendations, setRecommendations] = useState<{ subject: string; recommendation: string; priority: number }[]>([]);
  const [goals, setGoals] = useState<{ goals: string[]; tips: string[] } | null>(null);

  const prioritizeMutation = useMutation({
    mutationFn: () => aiApi.prioritizeTasks(),
    onSuccess: (res) => setPriorities(res.data.data || []),
  });

  const recommendMutation = useMutation({
    mutationFn: () => aiApi.studyRecommendations(),
    onSuccess: (res) => setRecommendations(res.data.data || []),
  });

  const goalsMutation = useMutation({
    mutationFn: () => aiApi.weeklyGoals(),
    onSuccess: (res) => setGoals(res.data.data),
  });

  const groupedTasks = priorities.reduce((acc, task) => {
    if (!acc[task.section]) acc[task.section] = [];
    acc[task.section].push(task);
    return acc;
  }, {} as Record<string, PrioritizedTask[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-primary-500" />
          AI Productivity Assistant
        </h1>
        <p className="text-slate-500">Get intelligent recommendations powered by AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Prioritization */}
        <Card title="Task Prioritization" className="space-y-4 lg:col-span-3">
          <p className="text-sm text-slate-500">Let AI analyze and prioritize your pending tasks</p>
          <Button
            onClick={() => prioritizeMutation.mutate()}
            loading={prioritizeMutation.isPending}
            className="w-full"
          >
            <Target className="w-4 h-4" /> Prioritize Tasks
          </Button>
          {prioritizeMutation.isPending && <Spinner />}
          {priorities.length > 0 && (
            <div className="space-y-4">
              {groupedTasks.urgent && groupedTasks.urgent.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Urgent Tasks
                  </h3>
                  <div className="space-y-2">
                    {groupedTasks.urgent.map((p, i) => (
                      <motion.div
                        key={p.taskId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                              <span className="capitalize">{p.status.replace('_', ' ')}</span>
                              {p.dueDate && (
                                <>
                                  <span>•</span>
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDate(p.dueDate)}</span>
                                </>
                              )}
                              {p.timeRemaining && <span>({p.timeRemaining})</span>}
                            </div>
                          </div>
                          <Badge variant="danger" className="shrink-0">{p.priority.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{p.reason}</p>
                        <p className="text-xs font-medium text-red-600 mt-0.5">Action: {p.action}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {groupedTasks.high && groupedTasks.high.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-600 mb-2">High Priority Tasks</h3>
                  <div className="space-y-2">
                    {groupedTasks.high.map((p, i) => (
                      <motion.div
                        key={p.taskId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                              <span className="capitalize">{p.status.replace('_', ' ')}</span>
                              {p.dueDate && (
                                <>
                                  <span>•</span>
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDate(p.dueDate)}</span>
                                </>
                              )}
                              {p.timeRemaining && <span>({p.timeRemaining})</span>}
                            </div>
                          </div>
                          <Badge variant="warning" className="shrink-0">{p.priority.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{p.reason}</p>
                        <p className="text-xs font-medium text-amber-600 mt-0.5">Action: {p.action}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {groupedTasks.upcoming && groupedTasks.upcoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-600 mb-2">Upcoming Tasks</h3>
                  <div className="space-y-2">
                    {groupedTasks.upcoming.map((p, i) => (
                      <motion.div
                        key={p.taskId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                              <span className="capitalize">{p.status.replace('_', ' ')}</span>
                              {p.dueDate && (
                                <>
                                  <span>•</span>
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDate(p.dueDate)}</span>
                                </>
                              )}
                              {p.timeRemaining && <span>({p.timeRemaining})</span>}
                            </div>
                          </div>
                          <Badge variant="info" className="shrink-0">{p.priority.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{p.reason}</p>
                        <p className="text-xs font-medium text-blue-600 mt-0.5">Action: {p.action}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {groupedTasks.completed && groupedTasks.completed.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-600 mb-2">Recently Completed</h3>
                  <div className="space-y-2">
                    {groupedTasks.completed.map((p, i) => (
                      <motion.div
                        key={p.taskId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-through text-slate-400 truncate">{p.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                              <span className="capitalize">{p.status.replace('_', ' ')}</span>
                              {p.dueDate && (
                                <>
                                  <span>•</span>
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDate(p.dueDate)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="success" className="shrink-0">DONE</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{p.reason}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Study Recommendations */}
        <Card title="Study Recommendations" className="space-y-4">
          <p className="text-sm text-slate-500">Get personalized study advice based on your progress</p>
          <Button
            onClick={() => recommendMutation.mutate()}
            loading={recommendMutation.isPending}
            className="w-full"
          >
            <BookOpen className="w-4 h-4" /> Get Recommendations
          </Button>
          {recommendMutation.isPending && <Spinner />}
          {recommendations.length > 0 && (
            <div className="space-y-2">
              {recommendations.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                >
                  <p className="text-sm font-medium">{r.subject}</p>
                  <p className="text-xs text-slate-500 mt-1">{r.recommendation}</p>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        {/* Weekly Goals */}
        <Card title="Weekly Goals" className="space-y-4">
          <p className="text-sm text-slate-500">Generate achievable goals for the week ahead</p>
          <Button
            onClick={() => goalsMutation.mutate()}
            loading={goalsMutation.isPending}
            className="w-full"
          >
            <Calendar className="w-4 h-4" /> Generate Goals
          </Button>
          {goalsMutation.isPending && <Spinner />}
          {goals && (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium mb-2">Goals</h4>
                <ul className="space-y-1">
                  {goals.goals?.map((g, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary-500 mt-0.5">•</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Tips</h4>
                <ul className="space-y-1">
                  {goals.tips?.map((t, i) => (
                    <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">💡</span> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
