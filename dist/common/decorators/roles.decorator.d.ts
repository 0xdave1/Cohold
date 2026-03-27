import { AdminRole } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: AdminRole[]) => import("@nestjs/common").CustomDecorator<string>;
