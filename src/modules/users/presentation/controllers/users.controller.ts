import type { AuthRequest } from '@modules/auth/middleware/auth.middleware';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler, sendSuccessResponse } from '@shared/http/response';
import type { Response } from 'express';

import type { UserService } from '../../application/UserService';

function requireUserId(req: AuthRequest): string {
  const userId = req.user?.id;
  if (!userId) throw AppErrorFactory.unauthorized('Authentication required');
  return userId;
}

export class UsersController {
  constructor(private readonly userService: UserService) {}

  getMe = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const profile = await this.userService.getMe(requireUserId(req), req.correlationId);
    sendSuccessResponse(res, profile);
  });

  updateProfile = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { firstName, lastName, name, version } = req.body as {
      firstName?: string;
      lastName?: string;
      name?: string;
      version?: number;
    };
    const profile = await this.userService.updateProfile(
      requireUserId(req),
      { firstName, lastName, name, version },
      req.correlationId,
    );
    sendSuccessResponse(res, profile);
  });

  getPreferences = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const profile = await this.userService.getMe(requireUserId(req), req.correlationId);
    sendSuccessResponse(res, profile.preferences);
  });

  updatePreferences = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { version, ...patch } = req.body as Record<string, unknown> & { version?: number };
    const profile = await this.userService.updatePreferences(
      requireUserId(req),
      patch,
      version,
      req.correlationId,
    );
    sendSuccessResponse(res, profile);
  });

  requestPhoneChange = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { phone } = req.body as { phone: string };
    const result = await this.userService.requestPhoneChange(
      requireUserId(req),
      phone,
      req.correlationId,
    );
    sendSuccessResponse(res, { message: 'Verification code sent', expiresAt: result.expiresAt });
  });

  verifyPhoneChange = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { phone, otp } = req.body as { phone: string; otp: string };
    const profile = await this.userService.verifyPhoneChange(
      requireUserId(req),
      phone,
      otp,
      req.correlationId,
    );
    sendSuccessResponse(res, profile);
  });

  deactivate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { reason } = (req.body ?? {}) as { reason?: string };
    const profile = await this.userService.deactivate(
      requireUserId(req),
      reason,
      req.correlationId,
    );
    sendSuccessResponse(res, profile);
  });
}
