export interface Clock {
  now(): Date;
  nowMs(): number;
  isoNow(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowMs: () => Date.now(),
  isoNow: () => new Date().toISOString(),
};

let _clock: Clock = systemClock;

export function getClock(): Clock {
  return _clock;
}

export function setClock(clock: Clock): void {
  _clock = clock;
}

export function resetClock(): void {
  _clock = systemClock;
}

export function getExpiryDate(ttlSeconds: number, from: Date = getClock().now()): Date {
  return new Date(from.getTime() + ttlSeconds * 1000);
}
