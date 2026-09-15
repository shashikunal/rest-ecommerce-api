import type { Session } from '@modules/auth/domain/repositories/SessionRepository';

export interface SessionDTO {
  sessionId: string;
  device: string;
  platform: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  current: boolean;
}

export interface SessionListResult {
  data: SessionDTO[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

function parseDevice(userAgent: string): { device: string; platform: string } {
  const ua = userAgent || 'unknown';
  let platform = 'unknown';
  if (/windows/i.test(ua)) platform = 'windows';
  else if (/mac os|macintosh/i.test(ua)) platform = 'macos';
  else if (/android/i.test(ua)) platform = 'android';
  else if (/iphone|ipad|ios/i.test(ua)) platform = 'ios';
  else if (/linux/i.test(ua)) platform = 'linux';
  const device = ua.length > 120 ? `${ua.slice(0, 117)}...` : ua;
  return { device, platform };
}

export function toSessionDTO(session: Session, currentSessionId: string): SessionDTO {
  const { device, platform } = parseDevice(session.userAgent);
  return {
    sessionId: session.id,
    device,
    platform,
    createdAt: session.createdAt,
    lastUsedAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    current: session.id === currentSessionId,
  };
}
