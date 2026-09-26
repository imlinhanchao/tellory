import { Column } from 'typeorm';

export abstract class BaseStoryFields {
  @Column({ comment: '标题' })
  title: string;

  @Column({ comment: '短名', nullable: true })
  shortname?: string;

  @Column({ comment: '简介', nullable: true })
  description?: string;

  @Column('longtext', { comment: '内容' })
  content: string;

  @Column({ comment: '文章段落数', nullable: true })
  passageSize: number;

  @Column({ comment: '成就数量', nullable: true })
  pointSize: number;

  @Column({ comment: '结局数量', nullable: true })
  endSize: number;

  @Column({ comment: '起始段落', nullable: true })
  startPassage?: string;

  @Column({ comment: '作者ID', nullable: true })
  authorId: string;

  @Column({ comment: '标签', nullable: true })
  tags?: string;
}
