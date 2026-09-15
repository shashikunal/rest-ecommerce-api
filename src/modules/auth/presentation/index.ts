export { AuthController } from '@modules/auth/presentation/controllers/auth.controller';
export { createAuthRoutes } from '@modules/auth/presentation/routes/auth.routes';
export {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateSendOtp,
  validateVerifyEmail,
  validateResetPassword,
  validateChangePassword,
} from '@modules/auth/presentation/validators/auth.validators';
