import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, LessThanOrEqual, In } from 'typeorm';
import { UsersService } from 'src/users/users.service';
import { Story } from './story.entity';
import { ApprovedStory } from './approved-story.entity';
import { StoryDto } from './stories.dto';
import { omit } from 'src/utils';
import { FingerTo } from 'fishpi';
import { ConfigService } from 'src/config/config.service';
import { isMailConfigured, sendStoryApprovedMail } from '../lib/mail';
import { NotificationService } from 'src/notification/notification.service';

type PublicStory = {
  id: string;
  title?: string;
  description?: string;
  shortname?: string | null;
  content?: string;
  passageSize?: number;
  tags?: string[];
  authorId?: string;
  author?: any;
  createdAt?: number;
  updatedAt?: number;
  status?: string;
};

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private storiesRepo: Repository<Story>,
    @InjectRepository(ApprovedStory)
    private approvedRepo: Repository<ApprovedStory>,
    private readonly usersService: UsersService,
    private readonly notificationService: NotificationService,
  ) {}

  private buildWhereForStories(
    createdAt: number,
    authorId?: string,
    search?: string,
  ): any {
    const createdCond = { createdAt: LessThanOrEqual(createdAt) };
    if (search) {
      const like = `%${search}%`;
      const clauses: any[] = [
        { title: Like(like), ...createdCond },
        { description: Like(like), ...createdCond },
        { tags: Like(like), ...createdCond },
      ];
      if (authorId) clauses.forEach((c) => (c.authorId = authorId));
      return clauses;
    }
    const where: any = { ...createdCond };
    if (authorId) where.authorId = authorId;
    return where;
  }

  private buildWhereForApproved(
    createdAt: number,
    authorId?: string,
    search?: string,
    isAdmin = false,
  ): any {
    const createdCond = { approvedAt: LessThanOrEqual(createdAt) };
    const where: any = { ...createdCond };
    if (authorId) where.authorId = authorId;
    if (!isAdmin) {
      where.isUnpublished = false;
    }
    if (search) {
      const like = `%${search}%`;
      const searchCond: any[] = [
        { title: Like(like), ...createdCond },
        { description: Like(like), ...createdCond },
      ];
      if (!isAdmin) {
        searchCond.forEach((c) => (c.isUnpublished = false));
      }
      return searchCond;
    }
    return where;
  }

  async create(dto: StoryDto): Promise<Story> {
    if (dto.authorId) {
      const author = await this.usersService.findById(dto.authorId);
      if (author && !author.isVerified && !author.from) {
        throw new ForbiddenException(
          '未验证邮箱的用户不允许创建新故事，请先前往个人中心验证邮箱',
        );
      }
    }
    const story = new Story(dto);
    // 空串必须落为 NULL，否则多个空串会撞上 unique 索引
    story.shortname = this.normalizeShortname(dto.shortname);
    await this.assertShortnameAvailable(story.shortname);
    return this.storiesRepo.save(story);
  }

  async getStorysByIds(ids: string[]): Promise<Story[]> {
    return this.storiesRepo.find({
      where: {
        id: In(ids),
      },
    });
  }

  async getApprovedByIds(ids: string[]): Promise<ApprovedStory[]> {
    return this.approvedRepo.find({
      where: {
        sourceStoryId: In(ids),
      },
    });
  }

  async findAll(
    createdAt = Date.now(),
    limit = 20,
    authorId?: string,
    search?: string,
    isPublicRequest = true,
    isAdmin = false,
  ) {
    if (isPublicRequest) {
      const where = this.buildWhereForApproved(
        createdAt,
        authorId,
        search,
        isAdmin,
      );
      const [rows, total] = await this.approvedRepo.findAndCount({
        where,
        order: { approvedAt: 'DESC' },
        take: limit,
      });

      const authorIds = rows.map((r) => r.authorId).filter(Boolean);
      const authors = await this.usersService.getUsers(authorIds);

      const data = rows.map((r) => {
        const tags = r.tags ? String(r.tags).split(',') : [];
        const mapped: PublicStory = {
          id: r.sourceStoryId,
          title: r.title,
          description: r.description,
          shortname: r.shortname,
          content: r.content,
          passageSize: r.passageSize || 0,
          tags,
          authorId: r.authorId,
          author: authors.find((a) => a.id === r.authorId) || null,
          createdAt: r.approvedAt,
          updatedAt: r.approvedAt,
          status: r.isUnpublished ? 'unpublished' : 'published',
        };
        return mapped;
      });

      return { data, total };
    }

    const where = this.buildWhereForStories(createdAt, authorId, search);
    const [data, total] = await this.storiesRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    const authorIds = data.map((story) => story.authorId);
    const authors = await this.usersService.getUsers(authorIds);
    return {
      data: data.map((story) => ({
        ...story,
        tags: story.tags?.split(',') || [],
        author: authors.find((author) => author.id === story.authorId),
      })),
      total,
    };
  }

  async findOne(id: string) {
    const story = await this.findById(id, false);
    const author = story
      ? await this.usersService.findById(story.authorId)
      : null;
    return story
      ? {
          ...story,
          tags: story.tags?.split(',') || [],
          author,
        }
      : null;
  }

  async findApprovedOne(idOrName: string) {
    const story = await this.findById(idOrName, true);
    const author = story
      ? await this.usersService.findById(story.authorId)
      : null;
    return story
      ? {
          ...story,
          tags: story.tags?.split(',') || [],
          author,
        }
      : null;
  }

  async findById(
    idOrName: string,
    isPublicRequest: true,
  ): Promise<ApprovedStory | null>;
  async findById(
    idOrName: string,
    isPublicRequest: false,
  ): Promise<Story | null>;
  async findById(idOrName: string, isPublicRequest = false) {
    const key = idOrName?.trim();
    if (!key) return null;
    // 一条查询同时匹配 id 与 shortname（where 数组在 TypeORM 中即 OR）
    if (isPublicRequest) {
      return this.approvedRepo.findOne({
        where: [{ sourceStoryId: key }, { shortname: key }],
      });
    }
    return this.storiesRepo.findOne({
      where: [{ id: key }, { shortname: key }],
    });
  }

  async update(
    id: string,
    dto: Partial<StoryDto>,
    authorId?: string,
  ): Promise<Story | null> {
    const story = await this.findById(id, false);
    if (!story) return null;
    if (authorId && story.authorId !== authorId)
      throw new Error('这不是你的故事');
    await this.assertShortnameAvailable(dto.shortname, story.id);
    Object.assign(story, omit(dto, ['id', 'createdAt', 'authorId']));
    if (dto.tags) story.tags = dto.tags.join(',');
    if ('shortname' in dto) {
      story.shortname = this.normalizeShortname(dto.shortname);
    }
    story.updatedAt = Date.now();
    await this.storiesRepo.update(story.id, story);
    return story;
  }

  /** 规范化 shortname：去首尾空格、校验字符集；空值统一返回 null */
  private normalizeShortname(shortname?: string | null): string {
    const name = shortname?.trim();
    if (!name) return '';
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error('短名只能包含字母、数字、下划线和连字符');
    }
    return name;
  }

  /** 校验 shortname 未被其他故事占用（空值不校验） */
  private async assertShortnameAvailable(
    shortname?: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (!shortname) return;
    const existing = await this.storiesRepo.findOne({
      where: { shortname },
    });
    if (existing && existing.id !== excludeId) {
      throw new Error('该短名已被占用');
    }
  }

  /** 校验 shortname 未被其它故事的已上架快照占用（历史快照可能残留旧短名） */
  private async assertApprovedShortnameAvailable(
    shortname?: string | null,
    sourceStoryId?: string,
  ): Promise<void> {
    if (!shortname) return;
    const existing = await this.approvedRepo.findOne({
      where: { shortname },
    });
    if (existing && existing.sourceStoryId !== sourceStoryId) {
      throw new Error('该短名已被其它已上架故事占用，请先修改后再上架');
    }
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.storiesRepo.delete({ id });
    return (res.affected ?? 0) > 0;
  }

  private async sendPublishNotice(
    story: Story,
    domain?: string,
  ): Promise<void> {
    const config = ConfigService.getConfig();
    if (!config?.noticeGoldenKey || !config?.noticeUsers) {
      return;
    }

    try {
      const author = story.authorId
        ? await this.usersService.findById(story.authorId)
        : null;
      const authorName = author?.username || author?.nickname || '未知用户';
      const origin = domain || process.env.DOMAIN || '';
      const reviewUrl = origin ? `${origin}/#/admin/reviews/${story.id}` : '';
      const reviewText = reviewUrl ? `[待审核](${reviewUrl})` : '待审核';
      const message = `用户 ${authorName} 提交了新故事《${story.title || '未命名'}》${reviewText}`;

      const noticeFinger = FingerTo(config.noticeGoldenKey);
      const users = config.noticeUsers
        .split(/[,，]/)
        .map((u: string) => u.trim())
        .filter(Boolean);

      for (const username of users) {
        noticeFinger.sendNotice(username, message).catch((err) => {
          console.error(`向用户 ${username} 发送提审通知失败:`, err);
        });
      }
    } catch (e) {
      console.error('发送提审通知异常:', e);
    }
  }

  async publish(
    id: string,
    authorId?: string,
    domain?: string,
  ): Promise<Story | null> {
    const story = await this.findById(id, false);
    if (!story) return null;
    if (authorId && story.authorId !== authorId)
      throw new Error('这不是你的故事');
    // author submits for review
    story.status = 'pending';
    story.submittedAt = Date.now();
    story.updatedAt = Date.now();
    await this.storiesRepo.save(story);
    await this.sendPublishNotice(story, domain);
    return story;
  }

  private async sendReviewNotice(
    story: Story,
    status: 'approved' | 'rejected',
    reason?: string,
    domain?: string,
  ): Promise<void> {
    const config = ConfigService.getConfig();

    try {
      const author = story.authorId
        ? await this.usersService.findById(story.authorId)
        : null;

      if (!author) {
        return;
      }

      const key = story.shortname || story.id;
      const title = story.title || '未命名';
      const siteDomain = domain || process.env.DOMAIN || '';

      // 1. 若作者来源为摸鱼派且配置了金手指，发送摸鱼派站内通知
      if (
        author.from === 'fishpi' &&
        author.username &&
        config?.noticeGoldenKey
      ) {
        let message = '';
        if (status === 'approved') {
          const storyUrl = siteDomain ? `${siteDomain}/#/play/${key}` : '';
          const storyLink = storyUrl ? `[${title}](${storyUrl})` : title;
          message = `您的故事《${storyLink}》已通过审核并上架。`;
        } else {
          const storyUrl = siteDomain
            ? `${siteDomain}/#/story-editor/${key}`
            : '';
          const storyLink = storyUrl ? `[${title}](${storyUrl})` : title;
          const reasonText = reason ? `，评审意见：${reason}` : '';
          message = `您的故事《${storyLink}》未通过审核${reasonText}。`;
        }

        const noticeFinger = FingerTo(config.noticeGoldenKey);
        noticeFinger.sendNotice(author.username, message).catch((err) => {
          console.error(`向作者 ${author.username} 发送审核结果通知失败:`, err);
        });
      }

      // 2. 故事审核通过且作者配置了已验证邮箱时，发送邮件通知（未验证邮箱不发送）
      if (
        status === 'approved' &&
        author.email &&
        author.isVerified &&
        isMailConfigured()
      ) {
        const playUrl = siteDomain
          ? `${siteDomain}/#/play/${key}`
          : `/#/play/${key}`;
        const authorName = author.nickname || author.username || '创作者';
        sendStoryApprovedMail({
          to: author.email,
          nickname: authorName,
          title,
          domain: siteDomain,
          playUrl,
        }).catch((err) => {
          console.error(`向作者 ${author.username} 发送审核通过邮件失败:`, err);
        });
      }
    } catch (e) {
      console.error('发送审核结果通知异常:', e);
    }
  }

  /** 管理员审核并上架：创建 ApprovedStory 快照并将 story 标记为已发布 */
  async approve(
    id: string,
    adminId: string,
    domain?: string,
  ): Promise<ApprovedStory | null> {
    const story = await this.findById(id, false);
    if (!story) return null;
    await this.assertApprovedShortnameAvailable(story.shortname, story.id);
    // mark published
    story.status = 'published';
    story.approvedAt = Date.now();
    story.reviewerId = adminId;
    story.updatedAt = Date.now();
    await this.storiesRepo.save(story);

    const approved = new ApprovedStory();
    approved.sourceStoryId = story.id;
    approved.title = story.title;
    approved.description = story.description;
    approved.content = story.content;
    approved.passageSize = story.passageSize;
    approved.shortname = story.shortname;
    approved.tags = story.tags;
    approved.authorId = story.authorId;
    approved.approvedBy = adminId;
    approved.approvedAt = Date.now();
    // If an approved snapshot already exists for this story, replace it.
    const existing = await this.approvedRepo.findOne({
      where: { sourceStoryId: story.id },
    });
    let result: ApprovedStory;
    if (existing) {
      existing.title = approved.title;
      existing.description = approved.description;
      existing.content = approved.content;
      existing.passageSize = approved.passageSize;
      existing.shortname = approved.shortname;
      existing.tags = approved.tags;
      existing.authorId = approved.authorId;
      existing.approvedBy = approved.approvedBy;
      existing.approvedAt = approved.approvedAt;
      result = await this.approvedRepo.save(existing);
    } else {
      result = await this.approvedRepo.save(approved);
    }

    // 1. 发送站内信通知：故事审核通过
    await this.notificationService
      .notifyStoryApproved({
        authorId: story.authorId,
        adminId,
        storyId: story.id,
        storyTitle: story.title,
        shortname: story.shortname,
      })
      .catch((err) => console.error('发送故事审核通过通知失败:', err));

    // 2. 如果故事存在历史发布（或有玩家在玩），发送站内信通知：正在玩的故事发布了更新
    const storyKeys = [story.id, story.shortname, existing?.id].filter(
      Boolean,
    ) as string[];
    await this.notificationService
      .notifyStoryUpdate({
        storyId: story.id,
        storyTitle: story.title,
        shortname: story.shortname,
        authorId: story.authorId,
        keys: storyKeys,
      })
      .catch((err) => console.error('发送故事更新通知失败:', err));

    await this.sendReviewNotice(story, 'approved', undefined, domain);
    return result;
  }

  /** 管理员拒绝投稿，保存原因并标记状态 */
  async reject(
    id: string,
    adminId: string,
    reason?: string,
    domain?: string,
  ): Promise<Story | null> {
    const story = await this.findById(id, false);
    if (!story) return null;
    story.status = 'rejected';
    story.reviewReason = reason || '';
    story.reviewerId = adminId;
    story.updatedAt = Date.now();
    await this.storiesRepo.save(story);
    await this.sendReviewNotice(story, 'rejected', reason, domain);
    return story;
  }

  /** 管理员下架已审核并上架的故事：标记为已下架 */
  async unpublish(id: string, adminId: string): Promise<boolean> {
    const story = await this.findById(id, false);
    if (!story) return false;
    if (story.status !== 'published') throw new Error('故事尚未发布');

    const approved = await this.approvedRepo.findOne({
      where: { sourceStoryId: story.id },
    });
    if (approved) {
      approved.isUnpublished = true;
      await this.approvedRepo.save(approved);
    }
    return true;
  }

  /** 管理员重新上架已下架的故事 */
  async republish(id: string, adminId: string): Promise<boolean> {
    const story = await this.findById(id, false);
    if (!story) return false;
    const approved = await this.approvedRepo.findOne({
      where: { sourceStoryId: story.id },
    });
    if (approved) {
      approved.isUnpublished = false;
      approved.approvedAt = Date.now();
      approved.approvedBy = adminId;
      await this.approvedRepo.save(approved);
    }
    return true;
  }
}
