import { useEffect, useCallback } from 'react';
import { usePomodoroStore } from '@/store';
import { studyApi } from '@/api/study';

export function usePomodoro() {
  const store = usePomodoroStore();

  useEffect(() => {
    if (!store.isRunning) return;

    const interval = setInterval(() => {
      store.tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [store.isRunning, store.tick]);

  const saveSession = useCallback(async () => {
    const { subjectId, studyPlanId, isBreak, initialWorkMinutes } = usePomodoroStore.getState();

    if (!isBreak) {
      const duration = initialWorkMinutes || 25; // Use initial work minutes, not timeLeft
      await studyApi.createSession({
        subjectId,
        studyPlanId,
        type: 'pomodoro',
        duration,
        startedAt: new Date(Date.now() - duration * 60000).toISOString(),
        endedAt: new Date().toISOString(),
      });
    }
  }, []);

  return { ...store, saveSession };
}
