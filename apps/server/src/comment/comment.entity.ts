import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

export interface CommentPosition {
  /**
   * 场景名称 / 段落名称
   */
  sceneName: string;

  /**
   * 起始位置（字符偏移量）
   */
  start: number;

  /**
   * 终止位置（字符偏移量）
   */
  end: number;

  /**
   * 变量快照（评论时的变量状态）
   */
  variableSnapshot?: Record<string, any>;

  /**
   * 选中的文本内容（划词引文）
   */
  selectedText?: string;
}

@Entity({ name: 'comment', comment: '故事评论表' })
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ comment: '故事ID' })
  storyId: string;

  @Index()
  @Column({ comment: '评论用户ID' })
  userId: string;

  @Column('text', { comment: '评论内容' })
  content: string;

  @Index()
  @Column({ nullable: true, comment: '根评论/父评论ID（用于回复评论）' })
  parentId?: string;

  @Column({ nullable: true, comment: '被回复的评论ID' })
  replyToId?: string;

  @Column({ nullable: true, comment: '被回复的用户ID' })
  replyToUserId?: string;

  @Column({ default: false, comment: '是否剧透' })
  isSpoiler: boolean = false;

  @Column('json', {
    nullable: true,
    comment: '划词评论位置信息(包含起始/终止位置、场景名称、变量快照等)',
  })
  position?: CommentPosition | null;

  @Column({ default: false, comment: '是否已删除' })
  isDeleted: boolean = false;

  @Column({ default: false, comment: '是否被管理员屏蔽' })
  isBlocked: boolean = false;

  @Column({ nullable: true, comment: '屏蔽原因' })
  blockReason?: string;

  @Column({ nullable: true, comment: '操作屏蔽的管理员ID' })
  blockedBy?: string;

  @Column('bigint', { nullable: true, comment: '屏蔽时间' })
  blockedAt?: number;

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

  constructor(partial?: Partial<Comment>) {
    if (partial) {
      Object.assign(this, partial);
      this.createdAt = partial.createdAt || Date.now();
      this.updatedAt = partial.updatedAt || Date.now();
    }
  }
}
