import type { User } from '../entities/User';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
  update(id: string, updates: Partial<User>): Promise<void>;
  delete(id: string): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
}
