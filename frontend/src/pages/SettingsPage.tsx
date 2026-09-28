import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Bell, Palette, Timer } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { Button, Input, Select, Card } from '@/components/ui';

export function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const profileMutation = useMutation({
    mutationFn: (data: { name: string }) => authApi.updateProfile(data),
    onSuccess: (res) => {
      setUser(res.data.data!);
      setMessage('Profile updated successfully');
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: (data: { preferences: NonNullable<typeof user>['preferences'] }) => authApi.updateProfile(data),
    onSuccess: (res) => {
      setUser(res.data.data!);
      setMessage('Preferences updated');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => setMessage('Password changed successfully'),
  });

  const resendVerificationMutation = useMutation({
    mutationFn: () => authApi.resendVerificationEmail(),
    onSuccess: async () => {
      setMessage('Verification email sent successfully');
      const res = await authApi.getProfile();
      setUser(res.data.data!);
    },
  });

  const { register: registerProfile, handleSubmit: handleProfileSubmit } = useForm({
    defaultValues: { name: user?.name || '' },
  });

  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword } = useForm<{
    currentPassword: string;
    newPassword: string;
  }>();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-500">Manage your account and preferences</p>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm">{message}</div>
      )}

      <Card title="Profile" className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <User className="w-4 h-4" /> Profile Information
        </div>
        <form onSubmit={handleProfileSubmit((data) => profileMutation.mutate(data))} className="space-y-4">
          <Input label="Name" {...registerProfile('name')} />
          <Input label="Email" value={user?.email || ''} disabled />
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${user?.isEmailVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {user?.isEmailVerified ? 'Email Verified' : 'Email Not Verified'}
            </span>
            {!user?.isEmailVerified && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => resendVerificationMutation.mutate()}
                loading={resendVerificationMutation.isPending}
              >
                Resend Verification
              </Button>
            )}
          </div>
          <Button type="submit" loading={profileMutation.isPending}>Save Profile</Button>
        </form>
      </Card>

      <Card title="Appearance" className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Palette className="w-4 h-4" /> Theme
        </div>
        <Select
          label="Theme"
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value as 'light' | 'dark' | 'system');
            preferencesMutation.mutate({
              preferences: { ...user!.preferences, theme: e.target.value as 'light' | 'dark' | 'system' },
            });
          }}
        />
      </Card>

      <Card title="Notifications" className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Bell className="w-4 h-4" /> Notification Preferences
        </div>
        <div className="space-y-3">
          {(['email', 'browser', 'realtime'] as const).map((key) => (
            <label key={key} className="flex items-center justify-between">
              <span className="text-sm capitalize">{key} Notifications</span>
              <input
                type="checkbox"
                checked={user?.preferences?.notifications?.[key] ?? true}
                onChange={(e) => {
                  preferencesMutation.mutate({
                    preferences: {
                      ...user!.preferences,
                      notifications: {
                        ...user!.preferences.notifications,
                        [key]: e.target.checked,
                      },
                    },
                  });
                }}
                className="w-4 h-4 rounded text-primary-600"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Pomodoro" className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Timer className="w-4 h-4" /> Timer Settings
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Work (min)"
            type="number"
            defaultValue={user?.preferences?.pomodoro?.workMinutes || 25}
            onBlur={(e) => {
              preferencesMutation.mutate({
                preferences: {
                  ...user!.preferences,
                  pomodoro: { ...user!.preferences.pomodoro, workMinutes: parseInt(e.target.value) },
                },
              });
            }}
          />
          <Input
            label="Break (min)"
            type="number"
            defaultValue={user?.preferences?.pomodoro?.breakMinutes || 5}
            onBlur={(e) => {
              preferencesMutation.mutate({
                preferences: {
                  ...user!.preferences,
                  pomodoro: { ...user!.preferences.pomodoro, breakMinutes: parseInt(e.target.value) },
                },
              });
            }}
          />
          <Input
            label="Long Break (min)"
            type="number"
            defaultValue={user?.preferences?.pomodoro?.longBreakMinutes || 15}
            onBlur={(e) => {
              preferencesMutation.mutate({
                preferences: {
                  ...user!.preferences,
                  pomodoro: { ...user!.preferences.pomodoro, longBreakMinutes: parseInt(e.target.value) },
                },
              });
            }}
          />
        </div>
      </Card>

      <Card title="Security" className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Lock className="w-4 h-4" /> Change Password
        </div>
        <form
          onSubmit={handlePasswordSubmit((data) => {
            passwordMutation.mutate(data);
            resetPassword();
          })}
          className="space-y-4"
        >
          <Input label="Current Password" type="password" {...registerPassword('currentPassword', { required: true })} />
          <Input label="New Password" type="password" {...registerPassword('newPassword', { required: true, minLength: 8 })} />
          <Button type="submit" loading={passwordMutation.isPending}>Change Password</Button>
        </form>
      </Card>
    </div>
  );
}
