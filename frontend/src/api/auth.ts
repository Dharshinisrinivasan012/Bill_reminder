import api from './client';
import type { User, ApiResponse } from '@/types';

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>>('/auth/login', data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  getProfile: () => api.get<ApiResponse<User>>('/auth/profile'),

  updateProfile: (data: Partial<{ name: string; preferences: User['preferences'] }>) =>
    api.put<ApiResponse<User>>('/auth/profile', data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post(`/auth/reset-password/${token}`, { password }),

  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email/${token}`),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  resendVerificationEmail: () =>
    api.post('/auth/resend-verification'),
};
