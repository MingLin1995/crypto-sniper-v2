// import { Injectable, Logger } from '@nestjs/common';
// import { NotificationPayload, NotificationChannel } from './interfaces/notification.interface';
// import { LineNotificationService } from './services/line-notification.service';
// import { EmailNotificationService } from './services/email-notification.service';
// import { SmsNotificationService } from './services/sms-notification.service';

// @Injectable()
// export class NotificationsService {
//   private readonly logger = new Logger(NotificationsService.name);

//   constructor(
//     private readonly emailNotificationService: EmailNotificationService,
//     private readonly lineNotificationService: LineNotificationService,
//     private readonly smsNotificationService: SmsNotificationService,
//   ) {}

//   async sendNotification(payload: NotificationPayload): Promise<void> {
//     const channels = payload.channels || [
//       NotificationChannel.EMAIL,
//       NotificationChannel.LINE,
//       NotificationChannel.SMS,
//     ];
//     const promises: Promise<void>[] = [];

//     for (const channel of channels) {
//       switch (channel) {
//         case NotificationChannel.EMAIL:
//           if (payload.recipient.email) {
//             promises.push(
//               this.emailNotificationService.sendNotification(payload).catch((error) => {
//                 this.logger.error(`Failed to send email notification for ${payload.event}:`, error);
//               }),
//             );
//           }
//           break;

//         case NotificationChannel.LINE:
//           if (payload.recipient.lineUserId) {
//             promises.push(
//               this.lineNotificationService.sendNotification(payload).catch((error) => {
//                 this.logger.error(`Failed to send LINE notification for ${payload.event}:`, error);
//               }),
//             );
//           }
//           break;

//         case NotificationChannel.SMS:
//           if (payload.recipient.phone) {
//             promises.push(
//               this.smsNotificationService.sendNotification(payload).catch((error) => {
//                 this.logger.error(`Failed to send SMS notification for ${payload.event}:`, error);
//               }),
//             );
//           }
//           break;

//         default:
//           this.logger.warn(`Unknown notification channel: ${channel}`);
//       }
//     }

//     await Promise.allSettled(promises);
//   }
// }
