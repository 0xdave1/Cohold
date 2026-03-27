import { OnGatewayConnection } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
export declare class UserGateway implements OnGatewayConnection {
    private readonly jwtService;
    private readonly configService;
    server: Server;
    constructor(jwtService: JwtService, configService: ConfigService);
    handleConnection(client: Socket): Promise<void>;
    handlePing(client: Socket, _data: any): void;
    notifyKycStatus(userId: string, status: string): void;
}
