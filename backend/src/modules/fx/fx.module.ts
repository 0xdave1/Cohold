import { Global, Module } from '@nestjs/common';
import { FxService } from './fx.service';
import { CacheModule } from '../cache/cache.module';

@Global()
@Module({
  imports: [CacheModule],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
