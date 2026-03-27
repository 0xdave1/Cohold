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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const config_1 = require("@nestjs/config");
let AuthService = class AuthService {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async validateUser(email, password) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return user;
    }
    async login(dto) {
        const user = await this.validateUser(dto.email, dto.password);
        const payload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            kycStatus: user.kycStatus,
        };
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('jwtUser.secret'),
            audience: this.configService.get('jwtUser.audience'),
            expiresIn: this.configService.get('jwtUser.accessTtl'),
        });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('jwtUser.secret'),
            audience: this.configService.get('jwtUser.audience'),
            expiresIn: this.configService.get('jwtUser.refreshTtl'),
        });
        return {
            accessToken,
            refreshToken,
        };
    }
    async refresh(refreshToken) {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.configService.get('jwtUser.secret'),
                audience: this.configService.get('jwtUser.audience'),
            });
            const newAccessToken = await this.jwtService.signAsync({
                sub: payload.sub,
                email: payload.email,
                username: payload.username,
            }, {
                secret: this.configService.get('jwtUser.secret'),
                audience: this.configService.get('jwtUser.audience'),
                expiresIn: this.configService.get('jwtUser.accessTtl'),
            });
            return {
                accessToken: newAccessToken,
                refreshToken,
            };
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map