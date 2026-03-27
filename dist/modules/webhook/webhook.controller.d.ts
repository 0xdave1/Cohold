import { PaymentService } from '../payment/payment.service';
import { ConfigService } from '@nestjs/config';
export declare class WebhookController {
    private readonly paymentService;
    private readonly configService;
    constructor(paymentService: PaymentService, configService: ConfigService);
    handlePaystackWebhook(signature: string, payload: any): Promise<void>;
}
