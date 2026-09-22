import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'comment_report', comment: '评论举报记录表' })
export class CommentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ comment: '被举报的评论ID' })
  commentId: string;

  @Index()
  @Column({ comment: '故事ID' })
  storyId: string;

  @Index()
  @Column({ comment: '举报用户ID' })
  reporterId: string;

  @Column({ comment: '举报原因/类别' })
  reason: string;

  @Column({ type: 'text', nullable: true, comment: '详细说明' })
  description?: string;

  @Column({
    default: 'pending',
    comment: '状态: pending(待处理) | resolved(已处理) | dismissed(已忽略)',
  })
  status: string = 'pending';

  @Column({ nullable: true, comment: '处理管理员ID' })
  resolvedBy?: string;

  @Column('bigint', { nullable: true, comment: '处理时间' })
  resolvedAt?: number;

  @Column({ nullable: true, comment: '处理备注' })
  handleNote?: string;

  @Column('bigint', { comment: '创建时间' })
  createdAt: number;

  @BeforeInsert()
  setCreateTimestamp() {
    this.createdAt = Date.now();
  }

  constructor(partial?: Partial<CommentReport>) {
    if (partial) {
      Object.assign(this, partial);
      this.createdAt = partial.createdAt || Date.now();
    }
  }
}
