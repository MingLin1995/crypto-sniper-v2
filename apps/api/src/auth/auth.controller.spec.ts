import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { ConfigService } from '@nestjs/config';

describe('AuthController (認證控制器)', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let emailVerificationService: jest.Mocked<EmailVerificationService>;

  const mockResponse = () => {
    const res: any = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockRequest = (user?: any) => ({
    ip: '127.0.0.1',
    headers: { 'user-agent': 'Jest-Agent' },
    user,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            validateUser: jest.fn(),
            login: jest.fn(),
            register: jest.fn(),
            logout: jest.fn(),
            refreshTokens: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
            resetPassword: jest.fn(),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: {
            sendVerificationEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    emailVerificationService = module.get(EmailVerificationService);
  });

  describe('login (登入)', () => {
    it('登入成功時應驗證使用者、簽發 Token 並設定 Cookie', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' };
      const user = { id: 'user-1', email: 'test@example.com', role: 'USER' };
      const authResult = {
        accessToken: 'at-123',
        refreshToken: 'rt-123',
        user: user as any,
      };

      authService.validateUser.mockResolvedValue(user as any);
      authService.login.mockResolvedValue(authResult as any);

      const res = mockResponse();
      const req = mockRequest();

      const result = await controller.login(req, loginDto, res);

      expect(authService.validateUser).toHaveBeenCalledWith(loginDto);
      expect(authService.login).toHaveBeenCalledWith(user, '127.0.0.1', 'Jest-Agent');
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'at-123', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'rt-123', expect.any(Object));
      expect(result).toEqual(authResult);
    });
  });

  describe('register (註冊)', () => {
    it('註冊成功時應調用 authService.register 並設定 Cookie', async () => {
      const registerDto = {
        email: 'new@example.com',
        nickname: 'TraderNew',
        code: '123456',
        password: 'password123',
      };
      const authResult = {
        accessToken: 'at-456',
        refreshToken: 'rt-456',
        user: { id: 'user-2', email: 'new@example.com', role: 'USER' } as any,
      };

      authService.register.mockResolvedValue(authResult as any);

      const res = mockResponse();
      const req = mockRequest();

      const result = await controller.register(req, registerDto, res);

      expect(authService.register).toHaveBeenCalledWith(registerDto, '127.0.0.1', 'Jest-Agent');
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual(authResult);
    });
  });

  describe('logout (登出)', () => {
    it('登出時應清理 Cookie 並呼叫 authService.logout', async () => {
      const user = { id: 'user-1', tokenId: 'token-1' };
      const req = mockRequest(user);
      const res = mockResponse();

      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith(user);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('sendVerificationEmail (發送驗證碼)', () => {
    it('應呼叫 emailVerificationService.sendVerificationEmail', async () => {
      emailVerificationService.sendVerificationEmail.mockResolvedValue({ message: '驗證碼已發送' } as any);

      const result = await controller.sendVerificationEmail({ email: 'verify@example.com' });

      expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith('verify@example.com');
      expect(result).toEqual({ message: '驗證碼已發送' });
    });
  });
});
