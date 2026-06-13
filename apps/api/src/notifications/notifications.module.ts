// import { Module } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { HttpModule } from '@nestjs/axios';
// import { MailerModule } from '@nestjs-modules/mailer';
// import { NotificationsService } from './notifications.service';
// import { LineNotificationService } from './services/line-notification.service';
// import { EmailNotificationService } from './services/email-notification.service';
// import { SmsNotificationService } from './services/sms-notification.service';
// import { NotificationTemplateService } from './templates/notification-template.service';

// @Module({
//   imports: [
//     HttpModule,
//     MailerModule.forRootAsync({
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => ({
//         transport: {
//           host: configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
//           port: configService.get<number>('SMTP_PORT') || 465,
//           secure: true,
//           auth: {
//             user: configService.get<string>('SMTP_USER'),
//             pass: configService.get<string>('SMTP_PASS'),
//           },
//         },
//         defaults: {
//           from: `"${configService.get<string>('APP_NAME') || 'App'}" <${configService.get<string>('SMTP_USER')}>`,
//         },
//       }),
//     }),
//   ],
//   providers: [
//     NotificationsService,
//     LineNotificationService,
//     EmailNotificationService,
//     SmsNotificationService,
//     NotificationTemplateService,
//   ],
//   exports: [NotificationsService],
// })
// export class NotificationsModule {}
