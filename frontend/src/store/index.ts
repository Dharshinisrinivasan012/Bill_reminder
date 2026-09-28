import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Notification } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'ppms-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    { name: 'ppms-theme' }
  )
);

export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  setNotifications: (notifications: Notification[], unreadCount: number) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
  setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}));

interface PomodoroState {
  isRunning: boolean;
  isBreak: boolean;
  timeLeft: number;
  initialWorkMinutes: number;
  sessionsCompleted: number;
  subjectId?: string;
  studyPlanId?: string;
  start: (workMinutes: number, subjectId?: string, studyPlanId?: string) => void;
  pause: () => void;
  resume: () => void;
  reset: (workMinutes: number) => void;
  tick: () => void;
  completeSession: () => void;
  startBreak: (breakMinutes: number) => void;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  isRunning: false,
  isBreak: false,
  timeLeft: 25 * 60,
  initialWorkMinutes: 25,
  sessionsCompleted: 0,
  start: (workMinutes, subjectId, studyPlanId) =>
    set({
      isRunning: true,
      isBreak: false,
      timeLeft: workMinutes * 60,
      initialWorkMinutes: workMinutes,
      subjectId,
      studyPlanId,
    }),
  pause: () => set({ isRunning: false }),
  resume: () => set({ isRunning: true }),
  reset: (workMinutes) =>
    set({ isRunning: false, isBreak: false, timeLeft: workMinutes * 60, initialWorkMinutes: workMinutes }),
  tick: () => {
    const { timeLeft, isRunning } = get();
    if (isRunning && timeLeft > 0) {
      set({ timeLeft: timeLeft - 1 });
    }
  },
  completeSession: () =>
    set((state) => ({
      isRunning: false,
      sessionsCompleted: state.sessionsCompleted + 1,
    })),
  startBreak: (breakMinutes) =>
    set({ isRunning: true, isBreak: true, timeLeft: breakMinutes * 60 }),
}));
