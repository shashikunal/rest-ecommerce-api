import { validateBody } from '@shared/validation/zod-validation';
import { z } from 'zod';

const emailSchema = z.string().email().min(1).max(254);
const passwordSchema = z.string().min(8).max(128);
const nameSchema = z.string().min(1).max(100);
const otpSchema = z.string().min(4).max(6);
const tokenSchema = z.string().min(1);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  roles: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: tokenSchema,
});

export const logoutSchema = z.object({});

export const logoutAllSchema = z.object({});

export const sendOtpSchema = z.object({
  email: emailSchema,
});

export const verifyEmailSchema = z.object({
  otp: otpSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

export const validateRegister = validateBody(registerSchema);
export const validateLogin = validateBody(loginSchema);
export const validateRefreshToken = validateBody(refreshTokenSchema);
export const validateSendOtp = validateBody(sendOtpSchema);
export const validateVerifyEmail = validateBody(verifyEmailSchema);
export const validateResetPassword = validateBody(resetPasswordSchema);
export const validateChangePassword = validateBody(changePasswordSchema);
