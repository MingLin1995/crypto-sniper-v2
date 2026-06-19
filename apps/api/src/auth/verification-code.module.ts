import { Module, Global } from '@nestjs/common';
import { VerificationCodeService } from './verification-code.service';

@Global()
@Module({
  providers: [VerificationCodeService],
  exports: [VerificationCodeService],
})
export class VerificationCodeModule {}
