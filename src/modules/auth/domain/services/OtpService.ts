export interface OtpService {
  generateOtp(email: string): Promise<{ otp: string; expiresAt: Date }>;
  verifyOtp(email: string, otp: string): Promise<boolean>;
  invalidateOtp(email: string): Promise<void>;
}
