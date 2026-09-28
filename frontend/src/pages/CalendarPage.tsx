import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { calendarApi } from '@/api';
import { Button, Card, Spinner } from '@/components/ui';
import { cn } from '@/utils';
import { useSocket } from '@/hooks/useSocket';
import type { CalendarEvent } from '@/types';

type ViewType = 'day' | 'week' | 'month';

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: any) => {
      const relevantTypes = ['task_created', 'task_updated', 'task_completed', 'study_session', 'exam_reminder'];
      if (relevantTypes.includes(notification.type)) {
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, queryClient]);

  const getDateRange = () => {
    if (view === 'day') {
      return { start: currentDate, end: addDays(currentDate, 1) };
    } else if (view === 'week') {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  };

  const { start, end } = getDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', view, start.toISOString()],
    queryFn: () => calendarApi.getEvents(start.toISOString(), end.toISOString(), view),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ taskId, scheduledStart, scheduledEnd }: { taskId: string; scheduledStart: string; scheduledEnd: string }) =>
      calendarApi.scheduleTask(taskId, scheduledStart, scheduledEnd),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const events = data?.data?.data?.events || [];

  const navigate = (direction: number) => {
    if (view === 'day') setCurrentDate(addDays(currentDate, direction));
    else if (view === 'week') setCurrentDate(addDays(currentDate, direction * 7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const getEventsForDay = (day: Date) =>
    events.filter((e: CalendarEvent) => e.start && isSameDay(new Date(e.start), day));

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      const scheduledStart = new Date(day);
      scheduledStart.setHours(9, 0, 0, 0);
      const scheduledEnd = new Date(day);
      scheduledEnd.setHours(10, 0, 0, 0);
      scheduleMutation.mutate({
        taskId,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
      });
    }
  };

  if (isLoading) return <Spinner size="lg" />;

  const monthDays = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-slate-500">Schedule and view your events</p>
        </div>
        <div className="flex items-center gap-2">
          {(['day', 'week', 'month'] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg capitalize',
                view === v ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {view === 'day'
            ? format(currentDate, 'EEEE, MMMM d, yyyy')
            : format(currentDate, 'MMMM yyyy')}
        </h2>
        <Button variant="ghost" onClick={() => navigate(1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {view === 'month' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-xs font-medium text-slate-500">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-slate-100 dark:border-slate-800" />
            ))}
            {monthDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[100px] p-1 border-b border-r border-slate-100 dark:border-slate-800',
                    isToday && 'bg-primary-50/50 dark:bg-primary-950/20'
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <span className={cn('text-xs font-medium', isToday && 'text-primary-600')}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((event: CalendarEvent) => (
                      <div
                        key={event.id}
                        className="text-xs px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: event.color }}
                        draggable={event.draggable}
                        onDragStart={(e) => e.dataTransfer.setData('taskId', event.id)}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-slate-400">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {eachDayOfInterval({ start, end }).map((day) => {
            const dayEvents = getEventsForDay(day);
            return (
              <Card key={day.toISOString()} className="p-3 min-h-[200px]"
                onDragOver={(e: React.DragEvent) => e.preventDefault()}
                onDrop={(e: React.DragEvent) => handleDrop(e, day)}
              >
                <p className="text-sm font-medium mb-2">{format(day, 'EEE d')}</p>
                {dayEvents.map((event: CalendarEvent) => (
                  <div
                    key={event.id}
                    className="text-xs p-1.5 rounded mb-1 text-white"
                    style={{ backgroundColor: event.color }}
                    draggable={event.draggable}
                    onDragStart={(e) => e.dataTransfer.setData('taskId', event.id)}
                  >
                    {event.title}
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <Card className="p-4">
          <h3 className="font-medium mb-4">{format(currentDate, 'EEEE, MMMM d')}</h3>
          {getEventsForDay(currentDate).length === 0 ? (
            <p className="text-sm text-slate-500">No events scheduled</p>
          ) : (
            <div className="space-y-2">
              {getEventsForDay(currentDate).map((event: CalendarEvent) => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="w-1 h-8 rounded" style={{ backgroundColor: event.color }} />
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-slate-500 capitalize">{event.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
