// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { HttpService } from '@nestjs/axios';
// import { lastValueFrom } from 'rxjs';
// import { NotificationService, NotificationPayload } from '../interfaces/notification.interface';
// import { NotificationTemplateService } from '../templates/notification-template.service';

// interface Every8dConfig {
//   uid: string;
//   pwd: string;
//   siteUrl: string;
//   custCode: string;
// }

// @Injectable()
// export class SmsNotificationService implements NotificationService {
//   private readonly logger = new Logger(SmsNotificationService.name);
//   private readonly every8dConfig: Every8dConfig;

//   constructor(
//     private readonly httpService: HttpService,
//     private readonly templateService: NotificationTemplateService,
//     private readonly configService: ConfigService,
//   ) {
//     // 驗證所有必要的環境變數
//     const uid = this.configService.get<string>('EVERY8D_UID');
//     const pwd = this.configService.get<string>('EVERY8D_PWD');
//     const siteUrl = this.configService.get<string>('EVERY8D_SITE_URL');
//     const custCode = this.configService.get<string>('EVERY8D_CUST_CODE');

//     if (!uid || !pwd || !siteUrl || !custCode) {
//       throw new Error(
//         'Every8d SMS configuration is incomplete. ' +
//           'Please set EVERY8D_UID, EVERY8D_PWD, EVERY8D_SITE_URL, and EVERY8D_CUST_CODE in your .env file.',
//       );
//     }

//     this.every8dConfig = { uid, pwd, siteUrl, custCode };
//   }

//   async sendNotification(payload: NotificationPayload): Promise<void> {
//     if (!payload.recipient.phone) {
//       this.logger.warn('No phone provided for SMS notification');
//       return;
//     }

//     try {
//       const template = this.templateService.generateTemplate(
//         payload.event,
//         payload.data,
//         payload.recipientType,
//       );

//       await this.sendSms(payload.recipient.phone, template.content);

//       this.logger.log(
//         `Successfully sent SMS notification for ${payload.event} to ${payload.recipient.phone}`,
//       );
//     } catch (error) {
//       this.logger.error(
//         `Failed to send SMS notification for ${payload.event} to ${payload.recipient.phone}:`,
//         error,
//       );
//       throw error;
//     }
//   }

//   // 呼叫 SMS API 發送簡訊（使用 Every8d）
//   private async sendSms(phone: string, message: string): Promise<void> {
//     const mobile = this.formatTaiwanPhone(phone);

//     const payload = {
//       uid: this.every8dConfig.uid,
//       pwd: this.every8dConfig.pwd,
//       subject: '驗證碼',
//       msg: message,
//       mobiles: mobile,
//       sendtime: '',
//       retrytime: '1440',
//     };

//     const url = `https://${this.every8dConfig.siteUrl}/${this.every8dConfig.custCode}/sendsms`;

//     try {
//       const response = await lastValueFrom(
//         this.httpService.post(url, payload, {
//           headers: { 'Content-Type': 'application/json' },
//         }),
//       );

//       if (!response.data) {
//         throw new Error('SMS API returned empty response');
//       }

//       if (response.data.status !== '200') {
//         const errorMsg = response.data.message || 'Unknown error';
//         this.logger.error(`簡訊發送失敗: ${JSON.stringify(response.data)}`);
//         throw new Error(`SMS sending failed: ${errorMsg}`);
//       }

//       this.logger.debug(`SMS API response: ${JSON.stringify(response.data)}`);
//     } catch (error) {
//       if (error instanceof Error) {
//         this.logger.error(`發送簡訊錯誤: ${error.message}`, error.stack);
//       }
//       throw error;
//     }
//   }

//   /**
//    * 格式化台灣手機號碼為國際格式 (+886)
//    * @throws Error 如果號碼格式無效
//    */
//   private formatTaiwanPhone(phone: string): string {
//     // 去除非數字字元
//     const cleanPhone = phone.replace(/\D/g, '');

//     // 台灣手機號碼：09 開頭，共 10 碼
//     if (cleanPhone.startsWith('09') && cleanPhone.length === 10) {
//       return `+886${cleanPhone.substring(1)}`;
//     }

//     // 已經是國碼格式：886 開頭，共 12 碼
//     if (cleanPhone.startsWith('886') && cleanPhone.length === 12) {
//       return `+${cleanPhone}`;
//     }

//     // 已經有 + 號的國碼格式
//     if (phone.startsWith('+886') && cleanPhone.length === 12) {
//       return phone;
//     }

//     throw new Error(
//       `Invalid Taiwan phone number format: ${phone}. ` +
//         'Expected format: 09XXXXXXXX or +886XXXXXXXXX',
//     );
//   }
// }
