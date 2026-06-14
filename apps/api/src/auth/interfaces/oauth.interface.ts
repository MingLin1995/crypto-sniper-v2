export interface GoogleUserProfile {
  sub: string;
  name: string;
  email?: string;
  picture?: string;
}

export interface DiscordUserProfile {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramUserProfile {
  id: number | string;
  first_name?: string;
  username?: string;
  name?: string;
  email?: string;
}

export type OAuthUserProfile = GoogleUserProfile | DiscordUserProfile | TelegramUserProfile;
