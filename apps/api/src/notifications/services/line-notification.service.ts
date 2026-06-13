// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { NotificationService, NotificationPayload } from '../interfaces/notification.interface';
// import { NotificationTemplateService } from '../templates/notification-template.service';
// import { messagingApi } from '@line/bot-sdk';

// @Injectable()
// export class LineNotificationService implements NotificationService {
//   private readonly lineClient: messagingApi.MessagingApiClient;
//   private readonly logger = new Logger(LineNotificationService.name);

//   constructor(
//     private readonly templateService: NotificationTemplateService,
//     private readonly configService: ConfigService,
//   ) {
//     const channelAccessToken = this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');

//     if (!channelAccessToken) {
//       throw new Error(
//         'LINE_CHANNEL_ACCESS_TOKEN is not configured. ' +
//           'Please set it in your .env file to enable LINE notifications.',
//       );
//     }

//     this.lineClient = new messagingApi.MessagingApiClient({
//       channelAccessToken,
//     });
//   }

//   async sendNotification(payload: NotificationPayload): Promise<void> {
//     if (!payload.recipient.lineUserId) {
//       this.logger.warn('No lineUserId provided for notification');
//       return;
//     }

//     try {
//       const template = this.templateService.generateTemplate(
//         payload.event,
//         payload.data,
//         payload.recipientType,
//       );

//       await this.lineClient.pushMessage({
//         to: payload.recipient.lineUserId,
//         messages: [
//           {
//             type: 'text',
//             text: template.content,
//           },
//         ],
//       });

//       this.logger.log(
//         `Successfully sent LINE notification for ${payload.event} to ${payload.recipient.lineUserId}`,
//       );
//     } catch (error) {
//       this.logger.error(
//         `Failed to send LINE notification for ${payload.event} to ${payload.recipient.lineUserId}:`,
//         error,
//       );
//       throw error;
//     }
//   }
// }
