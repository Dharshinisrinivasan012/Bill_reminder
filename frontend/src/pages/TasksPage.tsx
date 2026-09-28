import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, LayoutGrid, List, Trash2, Edit2 } from 'lucide-react';
import { tasksApi } from '@/api/tasks';
import { Button, Input, Select, Textarea, Modal, Badge, EmptyState, Spinner } from '@/components/ui';
import { formatDate, priorityColors, cn } from '@/utils';
import { useSocket } from '@/hooks/useSocket';
import type { Task, TaskStatus, TaskPriority } from '@/types';

type ViewMode = 'list' | 'kanban';

export function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [previousStatuses, setPreviousStatuses] = useState<Record<string, TaskStatus>>({});
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: any) => {
      const relevantTypes = ['task_created', 'task_completed', 'task_updated'];
      if (relevantTypes.includes(notification.type)) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['kanban'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', search, statusFilter, priorityFilter],
    queryFn: () => tasksApi.getAll({ search, status: statusFilter, priority: priorityFilter, limit: 50 }),
  });

  const { data: kanbanData } = useQuery({
    queryKey: ['kanban'],
    queryFn: () => tasksApi.getKanban(),
    enabled: viewMode === 'kanban',
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => tasksApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData(['tasks', search, statusFilter, priorityFilter]);
      queryClient.setQueryData(['tasks', search, statusFilter, priorityFilter], (old: any) => {
        return {
          ...old,
          data: {
            ...old.data,
            data: old.data.data.map((task: Task) =>
              task._id === id ? { ...task, ...data } : task
            ),
          },
        };
      });
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['tasks', search, statusFilter, priorityFilter], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowModal(false);
      setEditingTask(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const kanbanMutation = useMutation({
    mutationFn: ({ taskId, status, order }: { taskId: string; status: string; order: number }) =>
      tasksApi.updateKanbanOrder(taskId, status, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-productivity'] });
    },
  });

  const tasks = data?.data?.data || [];
  const kanban = kanbanData?.data?.data;

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      kanbanMutation.mutate({ taskId, status, order: 0 });
    }
  };

  const handleTaskComplete = (task: Task) => {
    if (task.status === 'done') {
      // Restore previous status
      const previousStatus = previousStatuses[task._id] || 'todo';
      updateMutation.mutate({
        id: task._id,
        data: { status: previousStatus },
      });
    } else {
      // Store current status and set to done
      setPreviousStatuses(prev => ({ ...prev, [task._id]: task.status }));
      updateMutation.mutate({
        id: task._id,
        data: { status: 'done', completedAt: new Date().toISOString() },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-slate-500">Manage your tasks and projects</p>
        </div>
        <Button onClick={() => { setEditingTask(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={[
            { value: '', label: 'All Status' },
            { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'review', label: 'Review' },
            { value: 'done', label: 'Done' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <Select
          options={[
            { value: '', label: 'All Priority' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        />
        <div className="flex gap-1 border rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-2 rounded', viewMode === 'list' && 'bg-primary-100 text-primary-700')}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={cn('p-2 rounded', viewMode === 'kanban' && 'bg-primary-100 text-primary-700')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : viewMode === 'kanban' && kanban ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['todo', 'in_progress', 'review', 'done'] as TaskStatus[]).map((status) => (
            <div
              key={status}
              className="card p-4 min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, status)}
            >
              <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-500 mb-3">
                {status.replace('_', ' ')} ({kanban[status]?.length || 0})
              </h3>
              <div className="space-y-2">
                {kanban[status]?.map((task: Task) => (
                  <motion.div
                    key={task._id}
                    layout
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task._id)}
                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={task.status === 'done'}
                        onChange={() => handleTaskComplete(task)}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', task.status === 'done' && 'line-through text-slate-400')}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityColors[task.priority])}>
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span className="text-xs text-slate-400">{formatDate(task.dueDate)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<Filter className="w-12 h-12" />}
          title="No tasks found"
          description="Create your first task to get started"
          action={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Create Task</Button>}
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <motion.div
              key={task._id}
              layout
              className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={() => handleTaskComplete(task)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <div className="min-w-0">
                  <p className={cn('font-medium truncate', task.status === 'done' && 'line-through text-slate-400')}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityColors[task.priority])}>
                      {task.priority}
                    </span>
                    {task.category && <Badge>{task.category}</Badge>}
                    {task.dueDate && <span className="text-xs text-slate-400">{formatDate(task.dueDate)}</span>}
                    {task.tags?.map((tag) => <Badge key={tag} variant="info">{tag}</Badge>)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => { setEditingTask(task); setShowModal(true); }}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(task._id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <TaskModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingTask(null); }}
        task={editingTask}
        onSubmit={(data) => {
          if (editingTask) {
            updateMutation.mutate({ id: editingTask._id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function TaskModal({
  isOpen,
  onClose,
  task,
  onSubmit,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSubmit: (data: Partial<Task>) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: task ? {
      ...task,
      tags: Array.isArray(task.tags) ? task.tags.join(', ') : '',
    } : {
      title: '',
      description: '',
      priority: 'medium' as TaskPriority,
      status: 'todo' as TaskStatus,
      category: '',
      tags: '',
      recurrence: 'none',
    },
  });

  const handleFormSubmit = (data: any) => {
    // Transform tags from comma-separated string to array
    if (data.tags && typeof data.tags === 'string') {
      data.tags = data.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
    }
    onSubmit(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Edit Task' : 'New Task'} size="lg">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input label="Title" {...register('title', { required: true })} />
        <Textarea label="Description" {...register('description')} />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Priority"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
            {...register('priority')}
          />
          <Select
            label="Status"
            options={[
              { value: 'todo', label: 'To Do' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'review', label: 'Review' },
              { value: 'done', label: 'Done' },
            ]}
            {...register('status')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Category" {...register('category')} />
          <Input label="Due Date" type="datetime-local" {...register('dueDate')} />
        </div>
        <Input label="Tags (comma separated)" {...register('tags' as 'title')} />
        <Select
          label="Recurrence"
          options={[
            { value: 'none', label: 'None' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
          {...register('recurrence')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{task ? 'Update' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}
