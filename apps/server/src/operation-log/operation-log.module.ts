import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLog } from './operation-log.entity';
import { OperationLogService } from './operation-log.service';
import { OperationLogController } from './operation-log.controller';
import { OperationLogCleanupService } from './operation-log-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([OperationLog])],
  providers: [OperationLogService, OperationLogCleanupService],
  controllers: [OperationLogController],
  exports: [OperationLogService],
})
export class OperationLogModule {}
