import { Injectable, InternalServerErrorException, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private smtpUser!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const smtpHost = this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = Number(this.configService.get<number>('SMTP_PORT')) || 465;
    this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
    const smtpPass = this.configService.get<string>('SMTP_PASS') || '';

    if (!this.smtpUser || !smtpPass) {
      this.logger.warn('SMTP 憑證未正確設定，發送郵件功能可能無法使用。');
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: this.smtpUser,
        pass: smtpPass,
      },
    });
  }

  async send(to: string, subject: string, text: string, html: string): Promise<void> {
    if (!this.smtpUser) {
      throw new InternalServerErrorException('SMTP 伺服器憑證未正確設定，無法發送郵件');
    }

    try {
      await this.transporter.sendMail({
        from: `"CryptoSniper" <${this.smtpUser}>`,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      this.logger.error(`發送郵件至 ${to} 失敗：`, error);
      throw new InternalServerErrorException('信件寄送失敗，請稍後重試');
    }
  }
}
