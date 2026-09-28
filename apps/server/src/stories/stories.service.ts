import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, LessThanOrEqual, In, Brackets } from 'typeorm';
import { User } from 'src/users/user.entity';
import { UsersService } from 'src/users/users.service';
import { Story } from './story.entity';
import { ApprovedStory } from './approved-story.entity';
import { StoryHistory } from './story-history.entity';
import { StoryLike } from './story-like.entity';
import { Play } from '../play/play.entity';
import { Comment } from '../comment/comment.entity';
import { StoryDto } from './stories.dto';
import { omit } from 'src/utils';
import { FingerTo } from 'fishpi';
import { ConfigService } from 'src/config/config.service';
import { isMailConfigured, sendStoryApprovedMail } from '../lib/mail';
import { NotificationService } from 'src/notification/notification.service';
import { StoryBetaTester } from './story-beta-tester.entity';

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
  playCount?: number;
  commentCount?: number;
  likeCount?: number;
  liked?: boolean;
};

/** 公开列表排序方式：latest=最新，hot=热度（阅读数+评论数），liked=喜爱度（喜爱个数） */
export type StorySort = 'latest' | 'hot' | 'liked';

/** 故事公开统计信息 */
type StoryStat = {
  playCount: number;
  commentCount: number;
  likeCount: number;
  liked: boolean;
};

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private storiesRepo: Repository<Story>,
    @InjectRepository(ApprovedStory)
    private approvedRepo: Repository<ApprovedStory>,
    @InjectRepository(StoryHistory)
    private storyHistoryRepo: Repository<StoryHistory>,
    @InjectRepository(StoryLike)
    private storyLikeRepo: Repository<StoryLike>,
    @InjectRepository(StoryBetaTester)
    private storyBetaTesterRepo: Repository<StoryBetaTester>,
    @InjectRepository(Play)
    private playRepo: Repository<Play>,
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,
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

  /** 查询某故事当前的已上架快照（不存在时返回 null） */
  async findApprovedBySourceId(storyId: string): Promise<ApprovedStory | null> {
    return this.approvedRepo.findOne({ where: { sourceStoryId: storyId } });
  }

  async findAll(
    createdAt = Date.now(),
    limit = 20,
    authorId?: string,
    search?: string,
    isPublicRequest = true,
    isAdmin = false,
    sort: StorySort = 'latest',
    page = 1,
    viewerId?: string,
  ) {
    if (isPublicRequest) {
      const take = Math.max(1, Math.min(Number(limit) || 20, 100));
      let rows: ApprovedStory[];
      let total: number;

      if (sort === 'latest') {
        const where = this.buildWhereForApproved(
          createdAt,
          authorId,
          search,
          isAdmin,
        );
        [rows, total] = await this.approvedRepo.findAndCount({
          where,
          order: { approvedAt: 'DESC' },
          take,
        });
      } else {
        // 热度 / 喜爱度排序：使用偏移分页 + 子查询分数排序
        const p = Math.max(1, Number(page) || 1);
        const qb = this.approvedRepo.createQueryBuilder('s');
        if (!isAdmin) {
          qb.andWhere('s.isUnpublished = :unpub', { unpub: false });
        }
        if (authorId) {
          qb.andWhere('s.authorId = :authorId', { authorId });
        }
        if (search) {
          const like = `%${search}%`;
          qb.andWhere(
            new Brackets((w) => {
              w.where('s.title LIKE :like', { like }).orWhere(
                's.description LIKE :like',
                { like },
              );
            }),
          );
        }
        const scoreSql = this.buildStoryScoreSql(sort);
        qb.addSelect(scoreSql, 'story_score')
          .orderBy('story_score', 'DESC')
          .addOrderBy('s.approvedAt', 'DESC')
          .skip((p - 1) * take)
          .take(take);
        [rows, total] = await qb.getManyAndCount();
      }

      const stats = await this.getStoryStats(
        rows.map((r) => r.sourceStoryId),
        viewerId,
      );
      const authorIds = rows.map((r) => r.authorId).filter(Boolean);
      const authors = await this.usersService.getUsers(authorIds);

      const data = rows.map((r) => {
        const stat = stats.get(r.sourceStoryId) || this.emptyStat();
        const author = authors.find((a) => a.id === r.authorId) || null;
        return this.toPublicStory(r, author, stat);
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
        ...omit(story, ['content']),
        tags: story.tags?.split(',') || [],
        author: authors.find((author) => author.id === story.authorId),
      })),
      total,
    };
  }

  private emptyStat(): StoryStat {
    return { playCount: 0, commentCount: 0, likeCount: 0, liked: false };
  }

  /**
   * 生成排序分数子查询；表名从实体元数据获取以兼容 entityPrefix 前缀配置。
   * hot = 阅读数（去重玩家）+ 评论数；liked = 喜爱数。
   */
  private buildStoryScoreSql(sort: StorySort): string {
    if (sort === 'hot') {
      const playTable = this.playRepo.metadata.tablePath;
      const commentTable = this.commentRepo.metadata.tablePath;
      return `((SELECT COUNT(DISTINCT p.userId) FROM \`${playTable}\` p WHERE p.storyId = s.sourceStoryId) + (SELECT COUNT(*) FROM \`${commentTable}\` c WHERE c.storyId = s.sourceStoryId AND c.isDeleted = 0 AND c.isBlocked = 0))`;
    }
    const likeTable = this.storyLikeRepo.metadata.tablePath;
    return `(SELECT COUNT(*) FROM \`${likeTable}\` sl WHERE sl.storyId = s.sourceStoryId)`;
  }

  private toPublicStory(row: ApprovedStory, author: any, stat: StoryStat) {
    return {
      id: row.sourceStoryId,
      title: row.title,
      description: row.description,
      shortname: row.shortname,
      passageSize: row.passageSize || 0,
      tags: row.tags ? String(row.tags).split(',') : [],
      authorId: row.authorId,
      author: author || null,
      createdAt: row.approvedAt,
      updatedAt: row.approvedAt,
      status: row.isUnpublished ? 'unpublished' : 'published',
      playCount: stat.playCount,
      commentCount: stat.commentCount,
      likeCount: stat.likeCount,
      liked: stat.liked,
    };
  }

  /** 批量统计故事的阅读（去重玩家）、评论、喜爱数，并标记指定用户是否已喜爱 */
  private async getStoryStats(
    storyIds: string[],
    viewerId?: string,
  ): Promise<Map<string, StoryStat>> {
    const result = new Map<string, StoryStat>();
    const ids = Array.from(new Set(storyIds.filter(Boolean)));
    if (!ids.length) return result;
    for (const id of ids) {
      result.set(id, this.emptyStat());
    }

    const playRows = await this.playRepo
      .createQueryBuilder('p')
      .select('p.storyId', 'storyId')
      .addSelect('COUNT(DISTINCT p.userId)', 'cnt')
      .where('p.storyId IN (:...ids)', { ids })
      .groupBy('p.storyId')
      .getRawMany();
    for (const row of playRows) {
      const stat = result.get(row.storyId);
      if (stat) stat.playCount = Number(row.cnt) || 0;
    }

    const commentRows = await this.commentRepo
      .createQueryBuilder('c')
      .select('c.storyId', 'storyId')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.storyId IN (:...ids)', { ids })
      .andWhere('c.isDeleted = :del', { del: false })
      .andWhere('c.isBlocked = :blk', { blk: false })
      .groupBy('c.storyId')
      .getRawMany();
    for (const row of commentRows) {
      const stat = result.get(row.storyId);
      if (stat) stat.commentCount = Number(row.cnt) || 0;
    }

    const likeRows = await this.storyLikeRepo
      .createQueryBuilder('sl')
      .select('sl.storyId', 'storyId')
      .addSelect('COUNT(*)', 'cnt')
      .where('sl.storyId IN (:...ids)', { ids })
      .groupBy('sl.storyId')
      .getRawMany();
    for (const row of likeRows) {
      const stat = result.get(row.storyId);
      if (stat) stat.likeCount = Number(row.cnt) || 0;
    }

    if (viewerId) {
      const likedRows = await this.storyLikeRepo.find({
        where: { userId: viewerId, storyId: In(ids) },
      });
      for (const like of likedRows) {
        const stat = result.get(like.storyId);
        if (stat) stat.liked = true;
      }
    }

    return result;
  }

  /** 喜爱故事（不可撤回；重复请求幂等） */
  async likeStory(
    storyId: string,
    userId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const approved = await this.approvedRepo.findOne({
      where: { sourceStoryId: storyId },
    });
    if (!approved) {
      throw new Error('故事不存在或未上架');
    }
    const existing = await this.storyLikeRepo.findOne({
      where: { storyId, userId },
    });
    if (!existing) {
      await this.storyLikeRepo.save(
        this.storyLikeRepo.create({ storyId, userId }),
      );
    }
    const likeCount = await this.storyLikeRepo.count({ where: { storyId } });
    return { liked: true, likeCount };
  }

  /** 查询故事喜爱状态：喜爱总数 + 指定用户是否已喜爱 */
  async getStoryLikeState(
    storyId: string,
    userId?: string,
  ): Promise<{ likeCount: number; liked: boolean }> {
    const likeCount = await this.storyLikeRepo.count({ where: { storyId } });
    let liked = false;
    if (userId) {
      const existing = await this.storyLikeRepo.findOne({
        where: { storyId, userId },
      });
      liked = !!existing;
    }
    return { likeCount, liked };
  }

  /** 用户喜爱的作品列表（仅返回当前仍在架的故事，按喜爱时间倒序） */
  async getUserLikedStories(userId: string) {
    const likes = await this.storyLikeRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (!likes.length) return { data: [], total: 0 };
    const storyIds = likes.map((l) => l.storyId);
    const rows = await this.approvedRepo.find({
      where: { sourceStoryId: In(storyIds), isUnpublished: false },
    });
    const orderIndex = new Map(storyIds.map((id, i) => [id, i]));
    rows.sort(
      (a, b) =>
        (orderIndex.get(a.sourceStoryId) ?? 0) -
        (orderIndex.get(b.sourceStoryId) ?? 0),
    );
    const stats = await this.getStoryStats(
      rows.map((r) => r.sourceStoryId),
      userId,
    );
    const authorIds = rows.map((r) => r.authorId).filter(Boolean);
    const authors = await this.usersService.getUsers(authorIds);
    const data = rows.map((r) => {
      const stat = stats.get(r.sourceStoryId) || {
        ...this.emptyStat(),
        liked: true,
      };
      const author = authors.find((a) => a.id === r.authorId) || null;
      return this.toPublicStory(r, author, { ...stat, liked: true });
    });
    return { data, total: data.length };
  }

  /** 用户作为内测者的故事列表（按加入时间倒序，含未发布作品） */
  async getUserBetaStories(userId: string) {
    const testers = await this.storyBetaTesterRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (!testers.length) return { data: [], total: 0 };
    const storyIds = testers.map((tester) => tester.storyId);
    const stories = await this.storiesRepo.find({
      where: { id: In(storyIds) },
    });
    const orderIndex = new Map(storyIds.map((id, index) => [id, index]));
    stories.sort(
      (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
    );
    const authorIds = stories.map((s) => s.authorId).filter(Boolean);
    const authors = await this.usersService.getUsers(authorIds);
    const data = stories.map((story) => {
      const author = authors.find((a) => a.id === story.authorId) || null;
      return {
        id: story.id,
        title: story.title,
        description: story.description,
        shortname: story.shortname,
        tags: story.tags ? story.tags.split(',') : [],
        status: story.status,
        passageSize: story.passageSize,
        updatedAt: Number(story.updatedAt) || 0,
        createdAt: Number(story.createdAt) || 0,
        author: author
          ? {
              id: author.id,
              username: author.username,
              nickname: author.nickname,
              avatar: author.avatar,
              from: author.from,
            }
          : null,
      };
    });
    return { data, total: data.length };
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
          updatedAt: Number(story.approvedAt),
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
    // 逻辑外键：手动清理内测用户关联（不依赖数据库级联）
    await this.storyBetaTesterRepo.delete({ storyId: id });
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

  /** 内测邀请：若被添加用户为摸鱼派用户且配置了金手指，发送摸鱼派站内通知 */
  private async sendBetaInviteNotice(
    user: User,
    story: Story,
    domain?: string,
  ): Promise<void> {
    const config = ConfigService.getConfig();
    if (
      user.id === story.authorId ||
      user.from !== 'fishpi' ||
      !user.username ||
      !config?.noticeGoldenKey
    ) {
      return;
    }

    try {
      const key = story.shortname || story.id;
      const siteDomain = domain || process.env.DOMAIN || '';
      const title = story.title || '未命名';
      const storyUrl = siteDomain ? `${siteDomain}/#/test/${key}` : '';
      const storyLink = storyUrl ? `[${title}](${storyUrl})` : title;
      const message = `你已成为故事《${storyLink}》的内测用户，可以在上架前提前体验。`;

      const noticeFinger = FingerTo(config.noticeGoldenKey);
      await noticeFinger.sendNotice(user.username, message).catch((err) => {
        console.error(`向内测用户 ${user.username} 发送摸鱼派通知失败:`, err);
      });
    } catch (e) {
      console.error('发送内测邀请摸鱼派通知异常:', e);
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
      // 审核通过新版本前，先将被替换的上一版本归档到故事历史表
      await this.archivePreviousSnapshot(existing);
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

    // 2. 查询该故事的内测用户（故事上架时需收到专门通知）
    const betaTesters = await this.storyBetaTesterRepo.find({
      where: { storyId: story.id },
    });
    const betaUserIds = Array.from(
      new Set(
        betaTesters
          .map((tester) => tester.userId)
          .filter((uid) => uid && uid !== story.authorId),
      ),
    );

    // 3. 如果故事存在历史发布（或有玩家在玩），发送站内信通知：正在玩的故事发布了更新（内测用户改收上架通知）
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
        excludeUserIds: betaUserIds,
      })
      .catch((err) => console.error('发送故事更新通知失败:', err));

    // 4. 发送站内信通知：内测的故事已上架
    await this.notificationService
      .notifyBetaStoryPublished({
        userIds: betaUserIds,
        storyId: story.id,
        storyTitle: story.title,
        shortname: story.shortname,
      })
      .catch((err) => console.error('发送内测故事上架通知失败:', err));

    await this.sendReviewNotice(story, 'approved', undefined, domain);
    return result;
  }

  /** 将上一版本（被替换的已上架快照）归档到故事历史表 */
  private async archivePreviousSnapshot(
    snapshot: ApprovedStory,
  ): Promise<void> {
    const history = new StoryHistory();
    history.storyId = snapshot.sourceStoryId;
    history.title = snapshot.title;
    history.shortname = snapshot.shortname;
    history.description = snapshot.description;
    history.content = snapshot.content;
    history.passageSize = snapshot.passageSize;
    history.pointSize = snapshot.pointSize;
    history.endSize = snapshot.endSize;
    history.startPassage = snapshot.startPassage;
    history.authorId = snapshot.authorId;
    history.tags = snapshot.tags;
    history.approvedBy = snapshot.approvedBy;
    history.approvedAt = snapshot.approvedAt;
    history.archivedAt = Date.now();
    await this.storyHistoryRepo.save(history);
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

  /** 管理员：分页查询某故事的历史版本列表（不含 content，减小传输体积） */
  async listStoryHistory(storyId: string, page?: number, limit?: number) {
    const p = Math.max(1, Number(page) || 1);
    const take = Math.max(1, Math.min(Number(limit) || 20, 100));
    const [rows, total] = await this.storyHistoryRepo.findAndCount({
      where: { storyId },
      order: { archivedAt: 'DESC' },
      skip: (p - 1) * take,
      take,
      select: {
        id: true,
        storyId: true,
        title: true,
        shortname: true,
        description: true,
        passageSize: true,
        pointSize: true,
        endSize: true,
        startPassage: true,
        authorId: true,
        tags: true,
        approvedBy: true,
        approvedAt: true,
        archivedAt: true,
      },
    });

    // 附加审核人信息
    const approverIds = Array.from(
      new Set(rows.map((r) => r.approvedBy).filter(Boolean)),
    ) as string[];
    const approvers = approverIds.length
      ? await this.usersService.getUsers(approverIds)
      : [];

    const data = rows.map((r) => {
      const approver = approvers.find((u) => u.id === r.approvedBy);
      return {
        ...r,
        approvedByUser: approver
          ? {
              id: approver.id,
              username: approver.username,
              nickname: approver.nickname,
              avatar: approver.avatar,
              from: approver.from,
            }
          : null,
      };
    });

    return {
      data,
      total,
      page: p,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  /** 管理员：获取单个历史版本详情（含 content） */
  async findStoryHistoryById(historyId: string): Promise<StoryHistory | null> {
    return this.storyHistoryRepo.findOne({ where: { id: historyId } });
  }

  /** 判断用户是否为故事的内测用户（匿名用户一律不算） */
  async isBetaTester(storyId: string, userId?: string): Promise<boolean> {
    if (!storyId || !userId) return false;
    const tester = await this.storyBetaTesterRepo.findOne({
      where: { storyId, userId },
    });
    return !!tester;
  }

  /** 获取故事的内测用户列表（附带用户公开信息） */
  async getBetaTesters(storyId: string) {
    const testers = await this.storyBetaTesterRepo.find({
      where: { storyId },
      order: { createdAt: 'DESC' },
    });
    if (!testers.length) return [];
    const users = await this.usersService.getUsers(
      testers.map((tester) => tester.userId),
    );
    const userMap = new Map(users.map((user) => [user.id, user]));
    return testers
      .map((tester) => {
        const user = userMap.get(tester.userId);
        if (!user) return null;
        return {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          from: user.from,
          addedAt: Number(tester.createdAt),
        };
      })
      .filter((tester) => tester !== null);
  }

  async addBetaTester(
    storyId: string,
    userId: string,
    domain?: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const existing = await this.storyBetaTesterRepo.findOne({
      where: { storyId, userId },
    });
    if (!existing) {
      const tester = this.storyBetaTesterRepo.create({ storyId, userId });
      await this.storyBetaTesterRepo.save(tester);
      // 站内信通知被添加的内测用户
      const story = await this.findById(storyId, false);
      if (story) {
        await this.notificationService
          .notifyBetaTesterAdded({
            userId,
            authorId: story.authorId,
            storyId: story.id,
            storyTitle: story.title,
            shortname: story.shortname,
          })
          .catch((err) => console.error('发送内测邀请通知失败:', err));
        // 若对方为摸鱼派用户且配置了金手指，同时发送摸鱼派站内通知
        await this.sendBetaInviteNotice(user, story, domain);
      }
    }
  }

  async removeBetaTester(storyId: string, userId: string): Promise<void> {
    await this.storyBetaTesterRepo.delete({ storyId, userId });
  }
}
