import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

export type NotificationType =
  'comment_story' | 'comment_reply' | 'story_update' | 'story_approved';

@Entity({ name: 'notifications', comment: '站内消息通知表' })
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ comment: '接收通知的用户ID' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 50,
    comment:
      '通知类型: comment_story, comment_reply, story_update, story_approved',
  })
  type: NotificationType;

  @Column({ comment: '通知标题' })
  title: string;

  @Column('text', { comment: '通知内容' })
  content: string;

  @Column({ nullable: true, comment: '触发操作的用户ID' })
  senderId?: string;

  @Column({ nullable: true, comment: '关联故事ID' })
  storyId?: string;

  @Column({ nullable: true, comment: '关联评论ID' })
  commentId?: string;

  @Column('json', {
    nullable: true,
    comment: '额外扩展信息（如故事名、短名等）',
  })
  extra?: Record<string, any>;

  @Column({ default: false, comment: '是否已读' })
  isRead: boolean = false;

  @Column('bigint', { comment: '创建时间' })
  createdAt: number;

  @Column('bigint', { comment: '更新时间' })
  updatedAt: number;

  @BeforeInsert()
  setCreateTimestamp() {
    const now = Date.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  setUpdateTimestamp() {
    this.updatedAt = Date.now();
  }
}
