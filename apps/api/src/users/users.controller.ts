import { Controller, Get, Body, Patch, Param, Delete, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UserResponseDto, PaginatedUserResponseDto } from './dto/user.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { ApiOkResponseGeneric } from '../common/decorators/api-ok-response-generic.decorator';
import { RequestUser } from '../auth/interfaces/auth.interface';

interface RequestWithUser {
  user: RequestUser;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  @ApiOperation({ summary: '取得當前用戶資訊' })
  @ApiOkResponseGeneric(UserResponseDto)
  getProfile(@Request() req: RequestWithUser) {
    return this.usersService.findOne(req.user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新當前用戶資訊' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponseGeneric(UserResponseDto)
  updateProfile(@Request() req: RequestWithUser, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.sub, updateUserDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: '取得所有用戶列表（ADMIN）',
    description: '支援分頁和搜尋功能。可依帳號、Email、電話、角色進行篩選。',
  })
  @ApiOkResponseGeneric(PaginatedUserResponseDto)
  findAll(@Query() queryDto: UserQueryDto) {
    return this.usersService.findAll(queryDto);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '取得特定用戶資訊（ADMIN）' })
  @ApiOkResponseGeneric(UserResponseDto)

  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新特定用戶資訊（ADMIN）' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponseGeneric(UserResponseDto)

  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '刪除用戶（ADMIN）' })
  @ApiOkResponseGeneric(MessageResponseDto)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
