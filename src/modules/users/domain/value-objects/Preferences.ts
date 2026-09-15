import type { UserPreferences } from '@modules/auth/domain/entities/User';

export const DEFAULT_PREFERENCES: UserPreferences = {
  marketingEmails: false,
  orderNotifications: true,
  securityNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  language: 'en',
  currency: 'USD',
};

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'hi'];
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

export function normalizePreferences(
  current: UserPreferences | undefined,
  patch: Partial<UserPreferences>,
): UserPreferences {
  const base = { ...DEFAULT_PREFERENCES, ...(current ?? {}) };
  const merged: UserPreferences = {
    marketingEmails: patch.marketingEmails ?? base.marketingEmails,
    orderNotifications: patch.orderNotifications ?? base.orderNotifications,
    securityNotifications: true,
    pushNotifications: patch.pushNotifications ?? base.pushNotifications,
    smsNotifications: patch.smsNotifications ?? base.smsNotifications,
    language: patch.language ?? base.language,
    currency: patch.currency ?? base.currency,
  };
  assertValidPreferences(merged);
  return merged;
}

export function assertValidPreferences(preferences: UserPreferences): void {
  if (!SUPPORTED_LANGUAGES.includes(preferences.language)) {
    throw new Error(`Unsupported language: ${preferences.language}`);
  }
  if (!SUPPORTED_CURRENCIES.includes(preferences.currency)) {
    throw new Error(`Unsupported currency: ${preferences.currency}`);
  }
}
