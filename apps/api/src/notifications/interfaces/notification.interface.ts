export enum NotificationEvent {
  USER_REGISTERED = 'USER_REGISTERED',
}

export enum RecipientType {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  TELEGRAM = 'TELEGRAM',
  DISCORD = 'DISCORD',
}

export interface NotificationPayload {
  event: NotificationEvent;
  recipientType: RecipientType;
  recipient: {
    email?: string;
    telegramChatId?: string;
    discordWebhook?: string;
  };
  data: NotificationData;
  channels?: NotificationChannel[];
}

export interface NotificationData {
  nickname: string;
  role: string;
  email?: string;
  telegramChatId?: string;
  discordWebhook?: string;
}

export interface NotificationService {
  sendNotification(payload: NotificationPayload): Promise<void>;
}
