import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'story_like', comment: '故事喜爱记录（不可撤回）' })
@Unique(['storyId', 'userId'])
export class StoryLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: '故事ID（原始故事ID）' })
  storyId: string;

  @Index()
  @Column({ comment: '用户ID' })
  userId: string;

  @Column('bigint', { comment: '喜爱时间' })
  createdAt: number = Date.now();

  @BeforeInsert()
  setCreateTimestamp() {
    this.createdAt = Date.now();
  }
}
