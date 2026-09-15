import { validateBody, validateQuery, validateParams } from '@shared/validation/zod-validation';
import { z } from 'zod';

const nameField = z.string().trim().min(1).max(100);
const phoneField = z.string().trim().min(7).max(20);

export const updateProfileSchema = z
  .object({
    firstName: nameField.optional(),
    lastName: nameField.optional(),
    name: nameField.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();

export const updatePreferencesSchema = z
  .object({
    marketingEmails: z.boolean().optional(),
    orderNotifications: z.boolean().optional(),
    securityNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    language: z.string().min(2).max(8).optional(),
    currency: z.string().min(3).max(3).optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();

export const requestPhoneChangeSchema = z
  .object({
    phone: phoneField,
  })
  .strict();

export const verifyPhoneChangeSchema = z
  .object({
    phone: phoneField,
    otp: z.string().trim().min(4).max(10),
  })
  .strict();

export const deactivateAccountSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

export const sessionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(2000).optional(),
});

export const validateUpdateProfile = validateBody(updateProfileSchema);
export const validateUpdatePreferences = validateBody(updatePreferencesSchema);
export const validateRequestPhoneChange = validateBody(requestPhoneChangeSchema);
export const validateVerifyPhoneChange = validateBody(verifyPhoneChangeSchema);
export const validateDeactivateAccount = validateBody(deactivateAccountSchema);
export const validateSessionIdParam = validateParams(sessionIdParamSchema);
export const validateSessionListQuery = validateQuery(sessionListQuerySchema);
