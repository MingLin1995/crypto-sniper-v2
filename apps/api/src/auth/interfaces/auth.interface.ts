export interface AuthenticatedUser {
  id: string;
  account: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  lineUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    account: string;
    role: string;
  };
}

export interface JwtPayload {
  sub: string;
  account: string;
  role: string;
  tokenId?: string; // RefreshToken ID
}

export interface RequestUser {
  sub: string;
  account: string;
  role: string;
  tokenId?: string;
}
