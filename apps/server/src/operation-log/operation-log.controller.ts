import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { OperationLogService } from './operation-log.service';

@Controller('operation-logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get('admin/list')
  async adminList(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('method') method?: string,
    @Query('path') path?: string,
    @Query('userId') userId?: string,
  ) {
    return this.operationLogService.listForAdmin({
      page,
      limit,
      method,
      path,
      userId,
    });
  }

  @Get('admin/:id')
  async adminDetail(@Param('id') id: string) {
    const log = await this.operationLogService.findOne(id);
    if (!log) {
      throw new Error('日志不存在');
    }
    return log;
  }
}
