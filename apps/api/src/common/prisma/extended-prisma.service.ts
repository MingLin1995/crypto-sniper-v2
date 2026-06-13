import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { softDeleteExtension } from './extensions/soft-delete.extension';

@Injectable()
export class ExtendedPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private _extendedClient?: ReturnType<typeof this.createExtendedClient>;
    private readonly pool: Pool;

    constructor() {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL is not defined');
        }

        const pool = new Pool({
            connectionString,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        super({
            adapter: new PrismaPg(pool),
            log: process.env.NODE_ENV === 'development'
                ? ['info', 'warn', 'error']
                : ['warn', 'error'],
        });

        this.pool = pool;
    }

    private createExtendedClient() {
        return this.$extends(softDeleteExtension);
    }

    get client() {
        if (!this._extendedClient) {
            this._extendedClient = this.createExtendedClient();
        }
        return this._extendedClient;
    }

    async onModuleInit() {
        await this.$connect();
        console.log('Database connected successfully');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
        console.log('Database disconnected successfully');
    }
}