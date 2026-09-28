import nodemailer from 'nodemailer';
import { config } from '../config';

const createTransporter = () => {
  if (!config.email.host || !config.email.user || !config.email.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
    console.log(`[Email Mock] Reason: SMTP credentials not configured (EMAIL_HOST, EMAIL_USER, EMAIL_PASS missing)`);
    return true;
  }

  try {
    console.log(`[Email Send] To: ${to}, Subject: ${subject}, From: ${config.email.from}`);
    console.log(`[Email Send] SMTP: ${config.email.host}:${config.email.port}`);
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
    console.log(`[Email Success] Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${to}:`, error);
    return false;
  }
};

export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  const verifyUrl = `${config.clientUrl}/verify-email?token=${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Verify Your Email</h2>
      <p>Thank you for registering with Personal Productivity Management System.</p>
      <p>Please click the button below to verify your email address:</p>
      <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
      <p>Or copy this link: ${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;
  await sendEmail(email, 'Verify Your Email - PPMS', html);
};

export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const resetUrl = `${config.clientUrl}/reset-password?token=${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Your Password</h2>
      <p>You requested a password reset for your PPMS account.</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
  `;
  await sendEmail(email, 'Reset Your Password - PPMS', html);
};

export const sendReminderEmail = async (
  email: string,
  title: string,
  message: string
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${title}</h2>
      <p>${message}</p>
      <a href="${config.clientUrl}/dashboard" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Open Dashboard</a>
    </div>
  `;
  await sendEmail(email, `${title} - PPMS`, html);
};

export const sendWeeklySummaryEmail = async (
  email: string,
  stats: { tasksCompleted: number; habitsCompleted: number; studyMinutes: number }
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Weekly Productivity Summary</h2>
      <p>Here's your productivity summary for this week:</p>
      <ul>
        <li>Tasks Completed: ${stats.tasksCompleted}</li>
        <li>Habits Completed: ${stats.habitsCompleted}</li>
        <li>Study Time: ${Math.round(stats.studyMinutes / 60)} hours</li>
      </ul>
      <a href="${config.clientUrl}/analytics" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">View Analytics</a>
    </div>
  `;
  await sendEmail(email, 'Weekly Productivity Summary - PPMS', html);
};

export const sendMonthlySummaryEmail = async (
  email: string,
  stats: { tasksCompleted: number; habitsCompleted: number; studyMinutes: number }
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Monthly Productivity Summary</h2>
      <p>Here's your productivity summary for this month:</p>
      <ul>
        <li>Tasks Completed: ${stats.tasksCompleted}</li>
        <li>Habits Completed: ${stats.habitsCompleted}</li>
        <li>Study Time: ${Math.round(stats.studyMinutes / 60)} hours</li>
      </ul>
      <a href="${config.clientUrl}/analytics" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">View Analytics</a>
    </div>
  `;
  await sendEmail(email, 'Monthly Productivity Summary - PPMS', html);
};

export const sendTaskReminderEmail = async (
  email: string,
  taskTitle: string,
  dueDate: string
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Task Reminder</h2>
      <p>Task "${taskTitle}" is due on ${dueDate}.</p>
      <a href="${config.clientUrl}/tasks" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">View Tasks</a>
    </div>
  `;
  await sendEmail(email, `Task Reminder: ${taskTitle} - PPMS`, html);
};

export const sendExamReminderEmail = async (
  email: string,
  topic: string,
  examDate: string
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Exam Reminder</h2>
      <p>Exam for "${topic}" is scheduled for ${examDate}.</p>
      <a href="${config.clientUrl}/study" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">View Study Plans</a>
    </div>
  `;
  await sendEmail(email, `Exam Reminder: ${topic} - PPMS`, html);
};
