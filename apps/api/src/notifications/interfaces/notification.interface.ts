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
  LINE = 'LINE',
}

export interface NotificationPayload {
  event: NotificationEvent;
  recipientType: RecipientType;
  recipient: {
    email?: string;
    phone?: string;
    lineUserId?: string;
  };
  data: NotificationData;
  channels?: NotificationChannel[];
}

export interface NotificationData {
  account: string;
  role: string;
  email?: string;
  phone?: string;
  lineUserId?: string;
}

export interface NotificationService {
  sendNotification(payload: NotificationPayload): Promise<void>;
}
