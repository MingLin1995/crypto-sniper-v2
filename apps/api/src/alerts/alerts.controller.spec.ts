import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

describe('AlertsController (價格通知控制器)', () => {
  let controller: AlertsController;
  let alertsService: jest.Mocked<AlertsService>;

  const mockReq = {
    user: { sub: 'user-123' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            toggle: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
    alertsService = module.get(AlertsService);
  });

  it('create 應呼叫 alertsService.create', async () => {
    const dto: any = { symbol: 'BTCUSDT', targetPrice: '70000', condition: 'ABOVE' };
    const expected = { id: 'alert-1', ...dto };
    alertsService.create.mockResolvedValue(expected as any);

    const result = await controller.create(mockReq, dto);

    expect(alertsService.create).toHaveBeenCalledWith('user-123', dto);
    expect(result).toEqual(expected);
  });

  it('findAll 應呼叫 alertsService.findAll', async () => {
    alertsService.findAll.mockResolvedValue([{ id: 'alert-1' }] as any);

    const result = await controller.findAll(mockReq);

    expect(alertsService.findAll).toHaveBeenCalledWith('user-123');
    expect(result).toHaveLength(1);
  });

  it('toggle 應呼叫 alertsService.toggle', async () => {
    alertsService.toggle.mockResolvedValue({ id: 'alert-1', isActive: false } as any);

    const result = await controller.toggle(mockReq, 'alert-1');

    expect(alertsService.toggle).toHaveBeenCalledWith('user-123', 'alert-1');
    expect(result.isActive).toBe(false);
  });

  it('update 應呼叫 alertsService.update', async () => {
    const dto: any = { targetPrice: '72000' };
    alertsService.update.mockResolvedValue({ id: 'alert-1', targetPrice: '72000' } as any);

    const result = await controller.update(mockReq, 'alert-1', dto);

    expect(alertsService.update).toHaveBeenCalledWith('user-123', 'alert-1', dto);
    expect(result.targetPrice).toBe('72000');
  });

  it('remove 應呼叫 alertsService.remove', async () => {
    alertsService.remove.mockResolvedValue({ message: 'Deleted' } as any);

    const result = await controller.remove(mockReq, 'alert-1');

    expect(alertsService.remove).toHaveBeenCalledWith('user-123', 'alert-1');
    expect(result).toEqual({ message: 'Deleted' });
  });
});
