// import { Injectable } from '@nestjs/common';
// import {
//   NotificationEvent,
//   NotificationData,
//   RecipientType,
// } from '../interfaces/notification.interface';
// import { ConfigService } from '@nestjs/config';

// export interface NotificationTemplate {
//   subject: string;
//   content: string;
// }

// @Injectable()
// export class NotificationTemplateService {
//   constructor(private readonly configService: ConfigService) {}

//   // 格式化日期時間 UTC+0 轉換為台北時間
//   // private formatDateTime(date: Date): string {
//   //   return date.toLocaleString('zh-TW', {
//   //     timeZone: 'Asia/Taipei',
//   //     year: 'numeric',
//   //     month: '2-digit',
//   //     day: '2-digit',
//   //     hour: '2-digit',
//   //     minute: '2-digit',
//   //     hour12: false
//   //   });
//   // }

//   generateTemplate(
//     event: NotificationEvent,
//     data: NotificationData,
//     recipientType: RecipientType,
//   ): NotificationTemplate {
//     switch (event) {
//       case NotificationEvent.USER_REGISTERED:
//         if (recipientType === RecipientType.ADMIN) {
//           return this.generateAdminUserRegisteredTemplate(data);
//         }
//         return this.generateUserRegisteredTemplate(data);

//       default:
//         throw new Error(`Unsupported notification event: ${event}`);
//     }
//   }

//   // 用戶註冊成功通知（發送給用戶）
//   private generateUserRegisteredTemplate(data: NotificationData): NotificationTemplate {
//     const appName = this.configService.get<string>('APP_NAME') || 'System';
//     const subject = `${appName} - 註冊成功通知`;
//     const content = `親愛的用戶，您好！

// 歡迎加入 ${appName}！

// 您的帳號已成功註冊：
// 帳號：${data.account}
// 身份：${data.role === 'ADMIN' ? '管理員' : '一般用戶'}
// ${data.email ? `Email: ${data.email}` : ''}
// ${data.phone ? `電話: ${data.phone}` : ''}

// 感謝您的註冊，祝您使用愉快！

// ---
// ${appName} 團隊
// `;

//     return { subject, content };
//   }

//   // 新用戶註冊通知（發送給管理員）
//   private generateAdminUserRegisteredTemplate(data: NotificationData): NotificationTemplate {
//     const appName = this.configService.get<string>('APP_NAME') || 'System';
//     const subject = `${appName} - 新用戶註冊通知`;
//     const content = `管理員，您好！

// 系統新增了一個用戶：

// 帳號資訊：
// 帳號：${data.account}
// 身份：${data.role === 'ADMIN' ? '管理員' : '一般用戶'}
// ${data.email ? `Email: ${data.email}` : ''}
// ${data.phone ? `電話: ${data.phone}` : ''}
// ${data.lineUserId ? `LINE ID: ${data.lineUserId}` : ''}

// ---
// ${appName} 系統通知
// `;

//     return { subject, content };
//   }
// }
