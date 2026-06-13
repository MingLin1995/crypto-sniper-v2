// import { Injectable, Logger } from '@nestjs/common';
// import { MailerService } from '@nestjs-modules/mailer';
// import { NotificationService, NotificationPayload } from '../interfaces/notification.interface';
// import { NotificationTemplateService } from '../templates/notification-template.service';

// @Injectable()
// export class EmailNotificationService implements NotificationService {
//   private readonly logger = new Logger(EmailNotificationService.name);

//   constructor(
//     private readonly mailerService: MailerService,
//     private readonly templateService: NotificationTemplateService,
//   ) {}

//   async sendNotification(payload: NotificationPayload): Promise<void> {
//     if (!payload.recipient.email) {
//       this.logger.warn('No email provided for notification');
//       return;
//     }

//     try {
//       const template = this.templateService.generateTemplate(
//         payload.event,
//         payload.data,
//         payload.recipientType,
//       );

//       await this.mailerService.sendMail({
//         to: payload.recipient.email,
//         subject: template.subject,
//         text: template.content,
//       });

//       this.logger.log(
//         `Successfully sent email notification for ${payload.event} to ${payload.recipient.email}`,
//       );
//     } catch (error) {
//       this.logger.error(
//         `Failed to send email notification for ${payload.event} to ${payload.recipient.email}:`,
//         error,
//       );
//       throw error;
//     }
//   }
// }
