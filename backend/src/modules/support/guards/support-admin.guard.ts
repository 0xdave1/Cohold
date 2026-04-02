import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Requires an authenticated admin that is explicitly allowed to handle support.
 * Do not grant support access to every admin by default.
 */
@Injectable()
export class SupportAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { id?: string; role?: string } | undefined;
    if (!user?.id) {
      throw new ForbiddenException('Admin authentication required');
    }
    const admin = await this.prisma.admin.findUnique({
      where: { id: user.id },
      select: { canSupport: true, role: true },
    });

    // Migration-safe access policy:
    // - explicit canSupport=true always allowed
    // - SUPER_ADMIN fallback allowed so existing super admins are not locked out post-migration
    const canAccess = !!admin?.canSupport || admin?.role === 'SUPER_ADMIN';
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to support inbox');
    }
    return true;
  }
}

