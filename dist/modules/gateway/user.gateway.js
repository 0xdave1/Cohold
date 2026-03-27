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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const socket_io_1 = require("socket.io");
let UserGateway = class UserGateway {
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async handleConnection(client) {
        const token = client.handshake.auth?.token ?? client.handshake.query?.token;
        if (!token || typeof token !== 'string') {
            client.disconnect(true);
            return;
        }
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get('jwtUser.secret'),
                audience: this.configService.get('jwtUser.audience'),
            });
            const userId = payload.sub;
            client.join(`user:${userId}`);
        }
        catch {
            client.disconnect(true);
        }
    }
    handlePing(client, _data) {
        client.emit('pong', { ts: Date.now() });
    }
    notifyKycStatus(userId, status) {
        this.server.to(`user:${userId}`).emit('kyc-status', { status });
    }
};
exports.UserGateway = UserGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], UserGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('ping'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], UserGateway.prototype, "handlePing", null);
exports.UserGateway = UserGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/ws/user',
        cors: { origin: '*', credentials: true },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], UserGateway);
//# sourceMappingURL=user.gateway.js.map