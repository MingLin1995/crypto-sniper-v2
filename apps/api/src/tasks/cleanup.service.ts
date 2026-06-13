import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';

@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    constructor(private readonly prisma: ExtendedPrismaService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleCleanup() {
        await this.cleanOldLogs();
        await this.cleanExpiredTokens();
    }

    async cleanOldLogs() {
        this.logger.log('Running daily log cleanup...');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            const deletedLogs = await this.prisma.client.systemLog.deleteMany({
                where: {
                    createdAt: {
                        lt: thirtyDaysAgo,
                    },
                },
            });

            this.logger.log(`Deleted ${deletedLogs.count} old logs.`);
        } catch (error) {
            this.logger.error('Failed to clean up logs', error);
        }
    }

    async cleanExpiredTokens() {
        this.logger.log('Running expired refresh tokens cleanup...');
        try {
            const deletedTokens = await this.prisma.client.refreshToken.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date(),
                    },
                },
            });
            this.logger.log(`Deleted ${deletedTokens.count} expired refresh tokens.`);
        } catch (error) {
            this.logger.error('Failed to clean up refresh tokens', error);
        }
    }
}
