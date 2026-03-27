"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const config_1 = require("@nestjs/config");
let AdminAuthService = class AdminAuthService {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async validateAdmin(email, password) {
        const admin = await this.prisma.admin.findUnique({
            where: { email },
        });
        if (!admin) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const passwordValid = await bcrypt.compare(password, admin.passwordHash);
        if (!passwordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return admin;
    }
    async login(dto) {
        const admin = await this.validateAdmin(dto.email, dto.password);
        const payload = {
            sub: admin.id,
            email: admin.email,
            role: admin.role,
        };
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('jwtAdmin.secret'),
            audience: this.configService.get('jwtAdmin.audience'),
            expiresIn: this.configService.get('jwtAdmin.accessTtl'),
        });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('jwtAdmin.secret'),
            audience: this.configService.get('jwtAdmin.audience'),
            expiresIn: this.configService.get('jwtAdmin.refreshTtl'),
        });
        return {
            accessToken,
            refreshToken,
        };
    }
};
exports.AdminAuthService = AdminAuthService;
exports.AdminAuthService = AdminAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AdminAuthService);
//# sourceMappingURL=admin-auth.service.js.map