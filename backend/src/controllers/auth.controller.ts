import { Response } from 'express';
import crypto from 'crypto';
import { User, RefreshToken } from '../models';
import { AuthRequest } from '../types';
import { AppError, sendSuccess, asyncHandler, generateToken } from '../utils/helpers';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';
import { uploadImage } from '../services/cloudinary.service';

const parseExpiry = (expiry: string): Date => {
  const match = expiry.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + value * multipliers[unit]);
};

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    name,
    email,
    password,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendVerificationEmail(email, verificationToken);

  const accessToken = generateAccessToken(user._id.toString(), user.email);
  const refreshToken = generateRefreshToken(user._id.toString(), user.email);

  await RefreshToken.deleteMany({ userId: user._id });
  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: parseExpiry('7d'),
  });

  sendSuccess(
    res,
    {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences,
      },
      accessToken,
      refreshToken,
    },
    'Registration successful. Please verify your email.',
    201
  );
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  const accessToken = generateAccessToken(user._id.toString(), user.email);
  const refreshToken = generateRefreshToken(user._id.toString(), user.email);

  await RefreshToken.deleteMany({ userId: user._id });
  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: parseExpiry('7d'),
  });

  sendSuccess(res, {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      preferences: user.preferences,
    },
    accessToken,
    refreshToken,
  });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }
  sendSuccess(res, undefined, 'Logged out successfully');
});

export const refresh = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  const storedToken = await RefreshToken.findOne({ token: refreshToken });
  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(storedToken.userId);
  if (!user) {
    throw new AppError('User not found', 401);
  }

  const accessToken = generateAccessToken(user._id.toString(), user.email);
  const newRefreshToken = generateRefreshToken(user._id.toString(), user.email);

  await RefreshToken.deleteOne({ token: refreshToken });
  await RefreshToken.create({
    userId: user._id,
    token: newRefreshToken,
    expiresAt: parseExpiry('7d'),
  });

  sendSuccess(res, { accessToken, refreshToken: newRefreshToken });
});

export const verifyEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token } = req.params;

  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  sendSuccess(res, undefined, 'Email verified successfully');
});

export const forgotPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendPasswordResetEmail(email, resetToken);
  }

  sendSuccess(res, undefined, 'If an account exists, a reset link has been sent');
});

export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await RefreshToken.deleteMany({ userId: user._id });

  sendSuccess(res, undefined, 'Password reset successful');
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  sendSuccess(res, {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    isEmailVerified: user.isEmailVerified,
    preferences: user.preferences,
    createdAt: user.createdAt,
  });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  const { name, preferences } = req.body;
  if (name) user.name = name;
  if (preferences) {
    if (preferences.theme) user.preferences.theme = preferences.theme;
    if (preferences.notifications) {
      Object.assign(user.preferences.notifications, preferences.notifications);
    }
    if (preferences.pomodoro) {
      Object.assign(user.preferences.pomodoro, preferences.pomodoro);
    }
  }

  await user.save();
  sendSuccess(res, {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    preferences: user.preferences,
  });
});

export const uploadAvatar = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const avatarUrl = await uploadImage(req.file.buffer);
  if (avatarUrl) {
    user.avatar = avatarUrl;
    await user.save();
  }

  sendSuccess(res, { avatar: user.avatar });
});

export const resendVerificationEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  if (user.isEmailVerified) {
    throw new AppError('Email is already verified', 400);
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  await sendVerificationEmail(user.email, verificationToken);

  sendSuccess(res, undefined, 'Verification email sent successfully');
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.userId).select('+password');
  if (!user) throw new AppError('User not found', 404);

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword;
  await user.save();
  await RefreshToken.deleteMany({ userId: user._id });

  sendSuccess(res, undefined, 'Password changed successfully');
});
