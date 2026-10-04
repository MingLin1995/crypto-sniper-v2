import { Test, TestingModule } from '@nestjs/testing';
import { MarketController } from './market.controller';
import { ScreenerService } from './screener.service';

describe('MarketController (市場篩選控制器)', () => {
  let controller: MarketController;
  let screenerService: jest.Mocked<ScreenerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketController],
      providers: [
        {
          provide: ScreenerService,
          useValue: {
            screen: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MarketController>(MarketController);
    screenerService = module.get(ScreenerService);
  });

  it('screen 應呼叫 screenerService.screen 並回傳符合條件之標的', async () => {
    const dto: any = { timeframes: [] };
    const expected = [{ symbol: 'BTCUSDT', price: 65000, volume: 1000 }];
    screenerService.screen.mockResolvedValue(expected as any);

    const result = await controller.screen(dto);

    expect(screenerService.screen).toHaveBeenCalledWith(dto);
    expect(result).toEqual(expected);
  });
});
