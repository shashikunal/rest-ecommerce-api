import type { Logger } from '@config/logger';
import { AppError } from '@shared/errors/app-error';
import { ERROR_CODES } from '@shared/errors/error-codes';

import type { User } from '../../domain/entities/User';
import type { UserRepository } from '../../domain/repositories/UserRepository';

import { UserModel } from './user.schema';

export class MongoUserRepository implements UserRepository {
  constructor(private readonly logger: Logger) {}

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async save(user: User): Promise<void> {
    const doc = new UserModel({
      _id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      phoneVerified: user.phoneVerified ?? false,
      status: user.status ?? 'ACTIVE',
      preferences: user.preferences,
      version: user.version ?? 0,
      deletedAt: user.deletedAt ?? null,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      roles: user.roles,
      lastLoginAt: user.lastLoginAt,
    });
    await doc.save();
    this.logger.info('User saved', { userId: user.id });
  }

  async update(id: string, updates: Partial<User>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.phoneVerified !== undefined) updateData.phoneVerified = updates.phoneVerified;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.preferences !== undefined) updateData.preferences = updates.preferences;
    if (updates.version !== undefined) updateData.version = updates.version;
    if (updates.deletedAt !== undefined) updateData.deletedAt = updates.deletedAt;
    if (updates.passwordHash !== undefined) updateData.passwordHash = updates.passwordHash;
    if (updates.isEmailVerified !== undefined) updateData.isEmailVerified = updates.isEmailVerified;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.roles !== undefined) updateData.roles = updates.roles;
    if (updates.lastLoginAt !== undefined) updateData.lastLoginAt = updates.lastLoginAt;
    updateData.updatedAt = new Date();
    await UserModel.findByIdAndUpdate(id, updateData).exec();
    this.logger.info('User updated', { userId: id });
  }

  async delete(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id).exec();
    this.logger.info('User deleted', { userId: id });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await UserModel.countDocuments({ email: email.toLowerCase() }).exec();
    return count > 0;
  }

  private toDomain(doc: any): User {
    return {
      id: doc._id,
      email: doc.email,
      passwordHash: doc.passwordHash,
      name: doc.name,
      firstName: doc.firstName,
      lastName: doc.lastName,
      phone: doc.phone,
      phoneVerified: doc.phoneVerified ?? false,
      status: doc.status ?? 'ACTIVE',
      preferences: doc.preferences,
      version: doc.version ?? 0,
      deletedAt: doc.deletedAt ?? null,
      isEmailVerified: doc.isEmailVerified,
      isActive: doc.isActive,
      roles: doc.roles,
      lastLoginAt: doc.lastLoginAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
