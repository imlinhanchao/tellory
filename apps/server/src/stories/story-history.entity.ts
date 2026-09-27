import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { BaseStoryFields } from './base-story.entity';

@Entity({
  name: 'story_history',
  comment: '故事历史版本（被新版本替换的已上架快照）',
})
export class StoryHistory extends BaseStoryFields {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ comment: '原始故事ID' })
  storyId: string;

  @Column({ comment: '该版本审核人ID', nullable: true })
  approvedBy?: string;

  @Column('bigint', { comment: '该版本审核通过时间' })
  approvedAt: number;

  @Column('bigint', { comment: '归档时间' })
  archivedAt: number = Date.now();
}
