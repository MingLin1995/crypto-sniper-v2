import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { IpBlacklistMiddleware } from './ip-blacklist.middleware';
import { IpBlacklistService } from './ip-blacklist.service';

describe('IpBlacklistMiddleware (IP 黑名單防護中介軟體)', () => {
  let middleware: IpBlacklistMiddleware;
  let service: IpBlacklistService;

  const mockIpBlacklistService = {
    isIpBlacklisted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpBlacklistMiddleware,
        {
          provide: IpBlacklistService,
          useValue: mockIpBlacklistService,
        },
      ],
    }).compile();

    middleware = module.get<IpBlacklistMiddleware>(IpBlacklistMiddleware);
    service = module.get<IpBlacklistService>(IpBlacklistService);

    jest.clearAllMocks();
  });

  it('應該要被成功載入', () => {
    expect(middleware).toBeDefined();
  });

  it('當 IP 未被封鎖時，應呼叫 next() 允許通過', async () => {
    mockIpBlacklistService.isIpBlacklisted.mockResolvedValue(false);

    const mockRequest = {
      headers: {},
      ip: '192.168.1.1',
      socket: {},
    } as unknown as Request;

    const mockResponse = {} as Response;
    const mockNext = jest.fn();

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(service.isIpBlacklisted).toHaveBeenCalledWith('192.168.1.1');
    expect(mockNext).toHaveBeenCalled();
  });

  it('當 IP 已被封鎖時，應拋出 ForbiddenException 拒絕請求', async () => {
    mockIpBlacklistService.isIpBlacklisted.mockResolvedValue(true);

    const mockRequest = {
      headers: {},
      ip: '192.168.1.1',
      socket: {},
      method: 'GET',
      originalUrl: '/test',
    } as unknown as Request;

    const mockResponse = {} as Response;
    const mockNext = jest.fn();

    await expect(
      middleware.use(mockRequest, mockResponse, mockNext)
    ).rejects.toThrow(ForbiddenException);

    expect(service.isIpBlacklisted).toHaveBeenCalledWith('192.168.1.1');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('應能正確將已由 Express 解析好的 req.ip 送入黑名單服務查詢', async () => {
    mockIpBlacklistService.isIpBlacklisted.mockResolvedValue(false);

    const mockRequest = {
      headers: {},
      ip: '1.2.3.4',
      socket: {},
    } as unknown as Request;

    const mockResponse = {} as Response;
    const mockNext = jest.fn();

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(service.isIpBlacklisted).toHaveBeenCalledWith('1.2.3.4');
  });

  it('規格化 IP 時，應去除 IPv6 映射格式的 ::ffff: 前綴', async () => {
    mockIpBlacklistService.isIpBlacklisted.mockResolvedValue(false);

    const mockRequest = {
      headers: {},
      ip: '::ffff:127.0.0.1',
      socket: {},
    } as unknown as Request;

    const mockResponse = {} as Response;
    const mockNext = jest.fn();

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(service.isIpBlacklisted).toHaveBeenCalledWith('127.0.0.1');
  });
});
