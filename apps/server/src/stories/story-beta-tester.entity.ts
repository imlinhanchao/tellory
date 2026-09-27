import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity({ name: 'story_beta_tester', comment: '故事内测用户表' })
@Unique(['storyId', 'userId'])
export class StoryBetaTester {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: '故事ID（逻辑外键）' })
  storyId: string;

  @Column({ comment: '用户ID（逻辑外键）' })
  userId: string;

  @Column('bigint', { comment: '添加时间' })
  createdAt: number = Date.now();
}
