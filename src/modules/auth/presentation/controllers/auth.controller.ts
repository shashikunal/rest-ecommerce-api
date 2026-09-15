import { AuthService } from '@modules/auth/application/auth.service';
import type { RegisterUserInput } from '@modules/auth/application/auth.service';
import { AppError } from '@shared/errors/app-error';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler } from '@shared/http/response';
import { sendSuccessResponse } from '@shared/http/response';
import { validateBody } from '@shared/validation/zod-validation';
import type { Request, Response } from 'express';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.register(req.body as RegisterUserInput);
    sendSuccessResponse(
      res,
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          roles: result.user.roles,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
      201,
    );
  });

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const result = await this.authService.login(
      email,
      password,
      req.ip ?? '',
      req.get('User-Agent') ?? '',
    );
    sendSuccessResponse(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  });

  refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    const result = await this.authService.refreshTokens(refreshToken);
    sendSuccessResponse(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  });

  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!accessToken) {
      throw AppErrorFactory.unauthorized('Access token required');
    }
    await this.authService.logout((req as any).user?.id ?? '', accessToken);
    res.status(204).send();
  });

  logoutAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!accessToken) {
      throw AppErrorFactory.unauthorized('Access token required');
    }
    await this.authService.logoutAll((req as any).user?.id ?? '');
    res.status(204).send();
  });

  sendOtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    await this.authService.forgotPassword(email);
    sendSuccessResponse(res, { message: 'OTP sent' });
  });

  verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { otp } = req.body;
    await this.authService.verifyEmail((req as any).user?.id ?? '', otp);
    sendSuccessResponse(res, { message: 'Email verified successfully' });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, otp, newPassword } = req.body;
    await this.authService.resetPassword(email, otp, newPassword);
    sendSuccessResponse(res, { message: 'Password reset successfully' });
  });

  changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    await this.authService.changePassword(
      (req as any).user?.id ?? '',
      currentPassword,
      newPassword,
    );
    sendSuccessResponse(res, { message: 'Password changed successfully' });
  });
}
