import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Restricts access to admin roles only.
 * Use after JwtAuthGuard; rejects when request.user.role === 'user'.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role as string | undefined;

    if (role === 'user' || !role) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
