export interface AuthenticatedUser {
  id: string;
  nickname: string;
  role: string;
  email?: string | null;
  googleId?: string | null;
  telegramId?: string | null;
  discordId?: string | null;
  telegramChatId?: string | null;
  discordWebhook?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    nickname: string;
    role: string;
  };
}

export interface JwtPayload {
  sub: string;
  email: string | null;
  role: string;
  tokenId?: string; // RefreshToken ID
}

export interface RequestUser {
  sub: string;
  email: string | null;
  role: string;
  tokenId?: string;
}
