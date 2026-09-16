import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { omit } from 'src/utils';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new Error('用户不存在');
    return omit(user, User.unsafeKey);
  }

  /** 记录当前用户是否已经完成编辑器引导 */
  @UseGuards(JwtAuthGuard)
  @Post('tour')
  async completeTour(@Request() req, @Body() body: { isToured?: boolean }) {
    const user = await this.usersService.setToured(
      req.user.userId,
      body?.isToured ?? true,
    );
    if (!user) throw new NotFoundException('用户不存在');
    return omit(user, User.unsafeKey);
  }

  @Get(':from/:username')
  async getUser(
    @Param('from') from: string,
    @Param('username') username: string,
  ) {
    return this.usersService.findOne(username, from);
  }

  @Get(':username')
  async getUserInfo(@Param('username') username: string) {
    return this.usersService.findOne(username, '');
  }
}
