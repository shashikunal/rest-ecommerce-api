import type { PublicProfile } from '@modules/users/domain/entities/UserProfile';

import type { CheckoutCustomer, CheckoutUserPort } from '../../domain/ports/CheckoutPorts';

export interface CheckoutUserService {
  getMe(userId: string, correlationId?: string): Promise<PublicProfile>;
}

export class UserServiceCheckoutUserAdapter implements CheckoutUserPort {
  constructor(private readonly users: CheckoutUserService) {}

  async getCustomer(userId: string, correlationId?: string): Promise<CheckoutCustomer | null> {
    try {
      const profile = await this.users.getMe(userId, correlationId);
      const name =
        [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.name;
      return { userId: profile.id, email: profile.email, name };
    } catch {
      return null;
    }
  }
}
