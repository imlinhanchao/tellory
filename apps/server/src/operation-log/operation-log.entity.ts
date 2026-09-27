import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'operation_log', comment: '接口操作日志' })
export class OperationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10, comment: '请求方法' })
  method: string;

  @Column({ length: 512, comment: '请求路径' })
  path: string;

  @Column({ nullable: true, comment: '用户 ID' })
  userId: string;

  @Column('json', { comment: '请求头' })
  headers: Record<string, unknown>;

  @Column('json', { nullable: true, comment: '请求体' })
  body: unknown;

  @Column('int', { nullable: true, comment: '响应状态码' })
  statusCode: number;

  @Column('int', { nullable: true, comment: '耗时（毫秒）' })
  durationMs: number;

  @Column('text', { nullable: true, comment: '错误信息' })
  error: string;

  @Index()
  @Column('bigint', { comment: '创建时间' })
  createdAt: number = Date.now();

  @BeforeInsert()
  setCreateTimestamp() {
    this.createdAt = Date.now();
  }
}
