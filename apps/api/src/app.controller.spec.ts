import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { ConfigService } from '@nestjs/config';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('1.0.0'),
          },
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  it('getHealth 應回傳 status: ok 與 API 連線正常訊息', () => {
    const res = appController.getHealth();
    expect(res.status).toBe('ok');
    expect(res.message).toBe('API 連線正常');
    expect(res.version).toBe('1.0.0');
    expect(res.timestamp).toBeDefined();
  });
});
