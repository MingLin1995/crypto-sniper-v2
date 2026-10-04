import { Test, TestingModule } from '@nestjs/testing';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

describe('WatchlistController (追蹤清單控制器)', () => {
  let controller: WatchlistController;
  let watchlistService: jest.Mocked<WatchlistService>;

  const mockReq = {
    user: { sub: 'user-123' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatchlistController],
      providers: [
        {
          provide: WatchlistService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WatchlistController>(WatchlistController);
    watchlistService = module.get(WatchlistService);
  });

  it('create 應新增標的至追蹤清單', async () => {
    const dto = { symbol: 'BTCUSDT' };
    const expected = { id: 'w-1', symbol: 'BTCUSDT' };
    watchlistService.create.mockResolvedValue(expected as any);

    const result = await controller.create(mockReq, dto);

    expect(watchlistService.create).toHaveBeenCalledWith('user-123', dto);
    expect(result).toEqual(expected);
  });

  it('findAll 應查詢當前用戶的所有追蹤標的', async () => {
    const list = [{ id: 'w-1', symbol: 'BTCUSDT' }];
    watchlistService.findAll.mockResolvedValue(list as any);

    const result = await controller.findAll(mockReq);

    expect(watchlistService.findAll).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(list);
  });

  it('remove 應自追蹤清單移除指定標的', async () => {
    watchlistService.remove.mockResolvedValue({ message: 'Removed' } as any);

    const result = await controller.remove(mockReq, 'BTCUSDT');

    expect(watchlistService.remove).toHaveBeenCalledWith('user-123', 'BTCUSDT');
    expect(result).toEqual({ message: 'Removed' });
  });
});
