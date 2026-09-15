import { v4 } from 'uuid';

export { setTimeout as sleep } from 'timers/promises';

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(): string {
  return v4();
}

export function maskSensitiveData(data: string): string {
  if (data.length <= 4) return '****';
  return data.slice(0, 2) + '*'.repeat(data.length - 4) + data.slice(-2);
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function isUUID(value: string): boolean {
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[4][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  return uuidPattern.test(value);
}

export function getTime(): Date {
  return new Date();
}

export function getTimestamp(): string {
  return getTime().toISOString();
}

export function getTTLTimestamp(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}
