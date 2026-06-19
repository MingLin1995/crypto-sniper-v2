import { Controller, Get, Post, Body, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SubscribeWebPushDto } from './dto/subscribe-web-push.dto';
import { UnsubscribeWebPushDto } from './dto/unsubscribe-web-push.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('web-push/public-key')
  @ApiOperation({ summary: '取得 Web Push VAPID 公鑰' })
  @ApiResponse({ status: 200, description: '成功取得 VAPID 公鑰。' })
  async getVapidPublicKey() {
    const publicKey = this.notificationsService.getVapidPublicKey();
    return { publicKey };
  }

  @Post('web-push/subscribe')
  @ApiOperation({ summary: '註冊或更新 Web Push 訂閱設定' })
  @ApiBody({ type: SubscribeWebPushDto })
  @ApiResponse({ status: 201, description: '成功註冊 Web Push 訂閱。' })
  async subscribeWebPush(@Request() req: any, @Body() dto: SubscribeWebPushDto) {
    return this.notificationsService.subscribeWebPush(req.user.sub, dto);
  }

  @Post('web-push/unsubscribe')
  @ApiOperation({ summary: '取消 Web Push 訂閱設定' })
  @ApiBody({ type: UnsubscribeWebPushDto })
  @ApiResponse({ status: 200, description: '成功取消 Web Push 訂閱。' })
  async unsubscribeWebPush(@Request() req: any, @Body() dto: UnsubscribeWebPushDto) {
    return this.notificationsService.unsubscribeWebPush(req.user.sub, dto);
  }
}
