import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OperationLogService } from './operation-log.service';

/** 操作日志保留天数 */
export const OPERATION_LOG_RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OperationLogCleanupService {
  private readonly logger = new Logger(OperationLogCleanupService.name);

  constructor(private readonly operationLogService: OperationLogService) {}

  /**
   * 每天凌晨 00:00 清理超过保留期（7 天）的操作日志。
   * 时区跟随服务器本地时间；如需固定时区，可在 @Cron 中传入 timeZone 选项（如 'Asia/Shanghai'）。
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredLogs(): Promise<void> {
    const cutoff =
      Date.now() - OPERATION_LOG_RETENTION_DAYS * DAY_MS;
    try {
      const removed = await this.operationLogService.removeBefore(cutoff);
      this.logger.log(
        `[定时清理] 已删除 ${OPERATION_LOG_RETENTION_DAYS} 天前的操作日志 ${removed} 条`,
      );
    } catch (err) {
      this.logger.error(
        `[定时清理] 操作日志清理失败: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
