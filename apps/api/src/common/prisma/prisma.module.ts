import { Global, Module } from '@nestjs/common';
import { ExtendedPrismaService } from './extended-prisma.service';

@Global()
@Module({
    providers: [
        ExtendedPrismaService,
        {
            provide: 'PrismaService',
            useExisting: ExtendedPrismaService,
        },
    ],
    exports: [ExtendedPrismaService, 'PrismaService'],
})
export class PrismaModule { }
