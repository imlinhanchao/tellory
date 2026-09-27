import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog } from './operation-log.entity';

type AdminOperationLogQuery = {
  page?: number;
  limit?: number;
  method?: string;
  path?: string;
  userId?: string;
};

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLog)
    private readonly operationLogRepo: Repository<OperationLog>,
  ) {}

  async create(payload: Partial<OperationLog>): Promise<OperationLog> {
    const entity: OperationLog = this.operationLogRepo.create({
      method: String(payload.method || '').toUpperCase(),
      path: String(payload.path || ''),
      userId: payload.userId || '',
      headers: this.toSafeJson(payload.headers) as Record<string, unknown>,
      body: this.toSafeJson(payload.body),
      statusCode:
        typeof payload.statusCode === 'number' ? payload.statusCode : 0,
      durationMs:
        typeof payload.durationMs === 'number' ? payload.durationMs : 0,
      error: payload.error || '',
    });
    return this.operationLogRepo.save(entity);
  }

  async findOne(id: string): Promise<OperationLog | null> {
    return this.operationLogRepo.findOne({ where: { id } });
  }

  async listForAdmin(query: AdminOperationLogQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const take = Math.max(1, Math.min(Number(query.limit) || 20, 100));
    const skip = (page - 1) * take;

    const qb = this.operationLogRepo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (query.method) {
      qb.andWhere('log.method = :method', {
        method: String(query.method).toUpperCase(),
      });
    }
    if (query.path) {
      qb.andWhere('log.path LIKE :path', { path: `%${query.path}%` });
    }
    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  /** 删除指定时间戳之前创建的日志，返回删除条数 */
  async removeBefore(timestamp: number): Promise<number> {
    const result = await this.operationLogRepo
      .createQueryBuilder()
      .delete()
      .from(OperationLog)
      .where('createdAt < :timestamp', { timestamp })
      .execute();
    return result.affected ?? 0;
  }

  private toSafeJson(value: unknown): unknown {
    if (value === undefined) return null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return value?.toString() || '';
    }
  }
}
