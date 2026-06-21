import { Test, TestingModule } from '@nestjs/testing';
import { IpBlacklistService } from './ip-blacklist.service';
import { ExtendedPrismaService } from '../prisma/extended-prisma.service';
import { RedisService } from '../redis/redis.service';

describe('IpBlacklistService (IP 黑名單防護服務)', () => {
  let service: IpBlacklistService;
  let mockPrisma: any;
  let mockRedisClient: any;
  let mockRedisService: any;

  beforeEach(async () => {
    // 模擬 Redis 用戶端
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      sismember: jest.fn(),
      exists: jest.fn().mockResolvedValue(1),
    };

    // 模擬 Redis 服務
    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    // 模擬 Prisma 服務
    mockPrisma = {
      client: {
        blacklistedIp: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpBlacklistService,
        {
          provide: ExtendedPrismaService,
          useValue: mockPrisma,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<IpBlacklistService>(IpBlacklistService);

    jest.clearAllMocks();
  });

  it('應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('initializeCache (初始化黑名單快取)', () => {
    it('當 Redis 快取已標記為初始化時，應跳過初始化步驟', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      await service.initializeCache();

      expect(mockRedisClient.get).toHaveBeenCalledWith('security:blacklist:initialized');
      expect(mockPrisma.client.blacklistedIp.findMany).not.toHaveBeenCalled();
    });

    it('當 Redis 未初始化時，應從資料庫載入所有被封鎖的 IP 並寫入 Redis', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.client.blacklistedIp.findMany.mockResolvedValue([
        { ip: '1.1.1.1' },
        { ip: '2.2.2.2' },
      ]);

      await service.initializeCache();

      expect(mockRedisClient.get).toHaveBeenCalledWith('security:blacklist:initialized');
      expect(mockPrisma.client.blacklistedIp.findMany).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('security:blacklist:ips');
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'security:blacklist:ips',
        '1.1.1.1',
        '2.2.2.2',
      );
      expect(mockRedisClient.set).toHaveBeenCalledWith('security:blacklist:initialized', '1');
    });

    it('即使資料庫沒有任何黑名單紀錄，也應設定初始化成功標記', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.client.blacklistedIp.findMany.mockResolvedValue([]);

      await service.initializeCache();

      expect(mockRedisClient.del).toHaveBeenCalledWith('security:blacklist:ips');
      expect(mockRedisClient.sadd).not.toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith('security:blacklist:initialized', '1');
    });
  });

  describe('isIpBlacklisted (檢查 IP 是否被封鎖)', () => {
    it('若 IP 存在於 Redis 黑名單 Set 中，應回傳 true', async () => {
      mockRedisClient.get.mockResolvedValue('1'); // 已初始化
      mockRedisClient.sismember.mockResolvedValue(1);

      const result = await service.isIpBlacklisted('1.2.3.4');

      expect(result).toBe(true);
      expect(mockRedisClient.sismember).toHaveBeenCalledWith('security:blacklist:ips', '1.2.3.4');
    });

    it('若 IP 不存在於 Redis 黑名單 Set 中，應回傳 false', async () => {
      mockRedisClient.get.mockResolvedValue('1');
      mockRedisClient.sismember.mockResolvedValue(0);

      const result = await service.isIpBlacklisted('1.2.3.4');

      expect(result).toBe(false);
    });

    it('若 Redis 發生連線異常，應降級改用資料庫查詢並正確回傳', async () => {
      mockRedisClient.get.mockResolvedValue('1');
      mockRedisClient.exists.mockRejectedValue(new Error('Redis connection lost'));
      mockPrisma.client.blacklistedIp.findUnique.mockResolvedValue({ ip: '1.2.3.4' });

      const result = await service.isIpBlacklisted('1.2.3.4');

      expect(result).toBe(true);
      expect(mockPrisma.client.blacklistedIp.findUnique).toHaveBeenCalledWith({
        where: { ip: '1.2.3.4' },
        select: { ip: true },
      });
    });

    it('若 Redis 中的初始化標記遺失 (exists === 0)，應觸發強制重新載入快取', async () => {
      mockRedisClient.exists.mockResolvedValue(0); // 模擬被 evicted
      mockRedisClient.get.mockResolvedValue(null); // initializeCache 內部 get 也返 null
      mockPrisma.client.blacklistedIp.findMany.mockResolvedValue([{ ip: '9.9.9.9' }]);
      mockRedisClient.sismember.mockResolvedValue(1);

      const result = await service.isIpBlacklisted('9.9.9.9');

      expect(result).toBe(true);
      expect(mockPrisma.client.blacklistedIp.findMany).toHaveBeenCalled();
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('security:blacklist:ips', '9.9.9.9');
    });
  });

  describe('blacklistIp (封鎖 IP)', () => {
    it('應寫入資料庫並同步新增至 Redis 黑名單 Set', async () => {
      mockPrisma.client.blacklistedIp.upsert.mockResolvedValue({
        id: 'some-id',
        ip: '8.8.8.8',
        reason: 'malicious',
      });

      const result = await service.blacklistIp('8.8.8.8', 'malicious');

      expect(mockPrisma.client.blacklistedIp.upsert).toHaveBeenCalledWith({
        where: { ip: '8.8.8.8' },
        update: { reason: 'malicious', updatedAt: expect.any(Date) },
        create: { ip: '8.8.8.8', reason: 'malicious' },
      });
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('security:blacklist:ips', '8.8.8.8');
      expect(result.ip).toBe('8.8.8.8');
    });
  });

  describe('whitelistIp (解鎖 IP)', () => {
    it('應從資料庫刪除並同步自 Redis 黑名單 Set 移除', async () => {
      mockPrisma.client.blacklistedIp.delete.mockResolvedValue({});

      const result = await service.whitelistIp('8.8.8.8');

      expect(mockPrisma.client.blacklistedIp.delete).toHaveBeenCalledWith({
        where: { ip: '8.8.8.8' },
      });
      expect(mockRedisClient.srem).toHaveBeenCalledWith('security:blacklist:ips', '8.8.8.8');
      expect(result.message).toBe('IP 已自黑名單中移除');
    });
  });
});
