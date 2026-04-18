import { Global, Module } from '@nestjs/common';
import { FxService } from './fx.service';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
