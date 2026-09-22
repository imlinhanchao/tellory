import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Comment, CommentPosition } from './comment.entity';
import { CommentReport } from './comment-report.entity';
import {
  CreateCommentDto,
  UpdateCommentDto,
  QueryCommentsDto,
  ReportCommentDto,
  ResolveReportDto,
  QueryReportsDto,
} from './comment.dto';
import { UsersService } from '../users/users.service';
import { StoriesService } from '../stories/stories.service';

export interface CommentUserSummary {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

export interface CommentWithDetails {
  id: string;
  storyId: string;
  userId: string;
  content: string;
  parentId?: string;
  replyToId?: string;
  replyToUserId?: string;
  isSpoiler: boolean;
  position?: CommentPosition | null;
  isDeleted: boolean;
  isBlocked: boolean;
  blockReason?: string;
  blockedBy?: string;
  blockedAt?: number;
  createdAt: number;
  updatedAt: number;
  author?: CommentUserSummary;
  replyToUser?: CommentUserSummary | null;
  replies?: CommentWithDetails[];
  replyCount?: number;
}

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(CommentReport)
    private readonly reportRepo: Repository<CommentReport>,
    private readonly usersService: UsersService,
    private readonly storiesService: StoriesService,
  ) {}

  /**
   * 校验故事是否存在
   */
  private async assertStoryExists(storyId: string): Promise<void> {
    const approved = await this.storiesService.getApprovedByIds([storyId]);
    if (!approved || approved.length === 0) {
      const stories = await this.storiesService.getStorysByIds([storyId]);
      if (!stories || stories.length === 0) {
        throw new NotFoundException('故事不存在');
      }
    }
  }

  /**
   * 规范化划词评论位置信息
   */
  private normalizePosition(
    position?: CreateCommentDto['position'],
  ): CommentPosition | null {
    if (!position) return null;

    const sceneName = position.sceneName || position.passageName;
    if (!sceneName) {
      throw new BadRequestException('划词评论必须包含场景名称 (sceneName)');
    }

    const rawStart = position.start ?? position.startOffset ?? 0;
    const rawEnd = position.end ?? position.endOffset ?? 0;
    const start = Math.min(rawStart, rawEnd);
    const end = Math.max(rawStart, rawEnd);

    return {
      sceneName,
      start,
      end,
      variableSnapshot: position.variableSnapshot ?? position.variables ?? {},
      selectedText: position.selectedText,
    };
  }

  /**
   * 批量填充评论作者及被回复人信息
   */
  private async attachUserDetails(
    comments: Comment[],
    isAdmin = false,
  ): Promise<CommentWithDetails[]> {
    if (!comments || comments.length === 0) return [];

    const userIds = Array.from(
      new Set([
        ...comments.map((c) => c.userId),
        ...comments.map((c) => c.replyToUserId).filter(Boolean),
      ]),
    ) as string[];

    const users = await this.usersService.getUsers(userIds);
    const userMap = new Map(
      users.map((u) => [
        u.id,
        {
          id: u.id,
          username: u.username,
          nickname: u.nickname || u.username,
          avatar: u.avatar || '',
        },
      ]),
    );

    return comments.map((c) => {
      const author = userMap.get(c.userId) || {
        id: c.userId,
        username: '未知用户',
        nickname: '未知用户',
        avatar: '',
      };
      const replyToUser = c.replyToUserId
        ? userMap.get(c.replyToUserId) || {
            id: c.replyToUserId,
            username: '未知用户',
            nickname: '未知用户',
            avatar: '',
          }
        : null;

      let displayContent = c.content;
      if (c.isDeleted) {
        displayContent = '[该评论已删除]';
      } else if (c.isBlocked && !isAdmin) {
        displayContent = '[该评论已被管理员屏蔽]';
      }

      return {
        ...c,
        author,
        replyToUser,
        content: displayContent,
        blockReason: isAdmin ? c.blockReason : undefined,
      };
    });
  }

  /**
   * 创建评论或回复
   */
  async create(
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentWithDetails> {
    await this.assertStoryExists(dto.storyId);

    let parentId: string | null = null;
    let replyToId: string | null = null;
    let replyToUserId: string | null = null;

    if (dto.parentId) {
      const parent = await this.commentRepo.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('回复的评论不存在');
      }
      if (parent.isDeleted) {
        throw new BadRequestException('该评论已被删除，无法回复');
      }
      if (parent.isBlocked) {
        throw new BadRequestException('该评论已被屏蔽，无法回复');
      }

      // 二级扁平化：如果被回复的是子评论，根 parentId 指向原根评论，replyToId 指向当前被回复的评论
      if (parent.parentId) {
        parentId = parent.parentId;
        replyToId = dto.replyToId || parent.id;
        replyToUserId = dto.replyToUserId || parent.userId;
      } else {
        parentId = parent.id;
        replyToId = dto.replyToId || parent.id;
        replyToUserId = dto.replyToUserId || parent.userId;
      }
    }

    const normalizedPosition = this.normalizePosition(dto.position);

    const comment = this.commentRepo.create({
      storyId: dto.storyId,
      userId,
      content: dto.content,
      parentId: parentId || undefined,
      replyToId: replyToId || undefined,
      replyToUserId: replyToUserId || undefined,
      isSpoiler: Boolean(dto.isSpoiler),
      position: normalizedPosition,
      isDeleted: false,
      isBlocked: false,
    });

    const saved = await this.commentRepo.save(comment);
    const [detailed] = await this.attachUserDetails([saved]);
    return detailed;
  }

  /**
   * 查询评论列表
   */
  async findAll(query: QueryCommentsDto, isAdmin = false) {
    const {
      storyId,
      sceneName,
      parentId,
      hasPosition,
      tree,
      includeSpoilers = true,
      includeBlocked,
      limit = 20,
      page = 1,
      createdAt,
    } = query;

    const qb = this.commentRepo.createQueryBuilder('comment');
    qb.where('comment.storyId = :storyId', { storyId });

    if (createdAt) {
      qb.andWhere('comment.createdAt <= :createdAt', { createdAt });
    }

    if (!includeSpoilers) {
      qb.andWhere('comment.isSpoiler = :isSpoiler', { isSpoiler: false });
    }

    if (includeBlocked === false) {
      qb.andWhere('comment.isBlocked = :isBlocked', { isBlocked: false });
    }

    if (hasPosition === true) {
      qb.andWhere('comment.position IS NOT NULL');
    } else if (hasPosition === false) {
      qb.andWhere('comment.position IS NULL');
    }

    const validSceneName =
      sceneName && sceneName !== 'undefined' && sceneName !== 'null'
        ? sceneName
        : undefined;

    if (validSceneName) {
      qb.andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(comment.position, '$.sceneName')) = :sceneName",
        { sceneName: validSceneName },
      );
    }

    if (tree) {
      // 树形模式：仅分页查询根评论（parentId 为 NULL），然后聚合各自的回复
      qb.andWhere('comment.parentId IS NULL');
      qb.orderBy('comment.createdAt', 'DESC');
      qb.skip((page - 1) * limit).take(limit);

      const [rootComments, total] = await qb.getManyAndCount();
      const detailedRoots = await this.attachUserDetails(rootComments, isAdmin);

      const rootIds = detailedRoots.map((r) => r.id);
      let repliesByParent: Record<string, CommentWithDetails[]> = {};

      if (rootIds.length > 0) {
        const replies = await this.commentRepo.find({
          where: { parentId: In(rootIds) },
          order: { createdAt: 'ASC' },
        });
        const detailedReplies = await this.attachUserDetails(replies, isAdmin);

        repliesByParent = detailedReplies.reduce(
          (acc, rep) => {
            if (!rep.parentId) return acc;
            if (!acc[rep.parentId]) acc[rep.parentId] = [];
            acc[rep.parentId].push(rep);
            return acc;
          },
          {} as Record<string, CommentWithDetails[]>,
        );
      }

      const data = detailedRoots.map((root) => {
        const replies = repliesByParent[root.id] || [];
        return {
          ...root,
          replies,
          replyCount: replies.length,
        };
      });

      return { data, total, page, limit };
    }

    // 扁平模式
    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === '') {
        qb.andWhere('comment.parentId IS NULL');
      } else {
        qb.andWhere('comment.parentId = :parentId', { parentId });
      }
    }

    qb.orderBy('comment.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [comments, total] = await qb.getManyAndCount();
    const data = await this.attachUserDetails(comments, isAdmin);

    return { data, total, page, limit };
  }

  /**
   * 查询单条评论及其所有回复
   */
  async findOne(id: string, isAdmin = false): Promise<CommentWithDetails> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    const [detailed] = await this.attachUserDetails([comment], isAdmin);
    const replies = await this.commentRepo.find({
      where: { parentId: id },
      order: { createdAt: 'ASC' },
    });
    const detailedReplies = await this.attachUserDetails(replies, isAdmin);

    return {
      ...detailed,
      replies: detailedReplies,
      replyCount: detailedReplies.length,
    };
  }

  /**
   * 检查评论是否已被回复
   */
  async hasReplies(commentId: string): Promise<boolean> {
    const count = await this.commentRepo.count({
      where: [
        { parentId: commentId, id: Not(commentId), isDeleted: false },
        { replyToId: commentId, id: Not(commentId), isDeleted: false },
      ],
    });
    return count > 0;
  }

  /**
   * 更新评论内容或剧透标记
   * 若评论已被回复，则不可修改
   */
  async update(
    id: string,
    userId: string,
    isAdmin: boolean,
    dto: UpdateCommentDto,
  ): Promise<CommentWithDetails> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }
    if (comment.userId !== userId && !isAdmin) {
      throw new ForbiddenException('无权修改该评论');
    }
    if (comment.isDeleted) {
      throw new BadRequestException('已删除的评论无法修改');
    }

    const hasReplies = await this.hasReplies(id);
    if (hasReplies) {
      throw new BadRequestException('该评论已被回复，不可修改');
    }

    if (dto.content !== undefined) {
      comment.content = dto.content;
    }
    if (dto.isSpoiler !== undefined) {
      comment.isSpoiler = dto.isSpoiler;
    }

    const saved = await this.commentRepo.save(comment);
    const [detailed] = await this.attachUserDetails([saved]);
    return detailed;
  }

  /**
   * 删除评论
   * 若评论已被回复，则不可删除
   */
  async remove(
    id: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<{ success: boolean; softDeleted: boolean }> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }
    if (comment.userId !== userId && !isAdmin) {
      throw new ForbiddenException('无权删除该评论');
    }

    const hasReplies = await this.hasReplies(id);
    if (hasReplies) {
      throw new BadRequestException('该评论已被回复，不可删除');
    }

    await this.commentRepo.delete(id);
    return { success: true, softDeleted: false };
  }

  /**
   * 统计某故事各场景下的划词评论数与剧透评论数
   */
  async getSceneCommentCounts(
    storyId: string,
  ): Promise<Record<string, { total: number; spoilers: number }>> {
    const comments = await this.commentRepo.find({
      where: { storyId, isDeleted: false, isBlocked: false },
      select: { id: true, position: true, isSpoiler: true },
    });

    const result: Record<string, { total: number; spoilers: number }> = {};
    for (const c of comments) {
      const sceneName = c.position?.sceneName;
      if (sceneName) {
        if (!result[sceneName]) {
          result[sceneName] = { total: 0, spoilers: 0 };
        }
        result[sceneName].total += 1;
        if (c.isSpoiler) {
          result[sceneName].spoilers += 1;
        }
      }
    }

    return result;
  }

  /**
   * 管理员屏蔽评论
   */
  async block(
    id: string,
    adminId: string,
    reason?: string,
  ): Promise<CommentWithDetails> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    comment.isBlocked = true;
    comment.blockReason = reason || '违反社区规范';
    comment.blockedBy = adminId;
    comment.blockedAt = Date.now();

    const saved = await this.commentRepo.save(comment);
    const [detailed] = await this.attachUserDetails([saved], true);
    return detailed;
  }

  /**
   * 管理员解除屏蔽
   */
  async unblock(id: string): Promise<CommentWithDetails> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    comment.isBlocked = false;
    comment.blockReason = undefined;
    comment.blockedBy = undefined;
    comment.blockedAt = undefined;

    const saved = await this.commentRepo.save(comment);
    const [detailed] = await this.attachUserDetails([saved], true);
    return detailed;
  }

  /**
   * 普通用户举报评论
   */
  async report(
    commentId: string,
    reporterId: string,
    dto: ReportCommentDto,
  ): Promise<CommentReport> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }
    if (comment.isDeleted) {
      throw new BadRequestException('该评论已被删除，无法举报');
    }

    const existing = await this.reportRepo.findOne({
      where: {
        commentId,
        reporterId,
        status: 'pending',
      },
    });
    if (existing) {
      throw new BadRequestException('您已举报过该评论，请耐心等待管理员审核');
    }

    const report = this.reportRepo.create({
      commentId,
      storyId: comment.storyId,
      reporterId,
      reason: dto.reason,
      description: dto.description,
      status: 'pending',
    });

    return this.reportRepo.save(report);
  }

  /**
   * 管理员查看举报列表
   */
  async findReports(query: QueryReportsDto) {
    const { status = 'pending', storyId, limit = 20, page = 1 } = query;
    const qb = this.reportRepo.createQueryBuilder('report');

    if (status && status !== 'all') {
      qb.andWhere('report.status = :status', { status });
    }
    if (storyId) {
      qb.andWhere('report.storyId = :storyId', { storyId });
    }

    qb.orderBy('report.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [reports, total] = await qb.getManyAndCount();

    const reporterIds = reports.map((r) => r.reporterId);
    const commentIds = reports.map((r) => r.commentId);

    const reporters =
      reporterIds.length > 0
        ? await this.usersService.getUsers(reporterIds)
        : [];
    const comments =
      commentIds.length > 0
        ? await this.commentRepo.find({ where: { id: In(commentIds) } })
        : [];
    const detailedComments =
      comments.length > 0 ? await this.attachUserDetails(comments, true) : [];

    const reporterMap = new Map(
      reporters.map((u) => [
        u.id,
        {
          id: u.id,
          username: u.username,
          nickname: u.nickname || u.username,
          avatar: u.avatar || '',
        },
      ]),
    );
    const commentMap = new Map(detailedComments.map((c) => [c.id, c]));

    const data = reports.map((r) => ({
      ...r,
      reporter: reporterMap.get(r.reporterId) || null,
      comment: commentMap.get(r.commentId) || null,
    }));

    return { data, total, page, limit };
  }

  /**
   * 管理员处理举报
   */
  async resolveReport(
    reportId: string,
    adminId: string,
    dto: ResolveReportDto,
  ): Promise<CommentReport> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('举报记录不存在');
    }

    if (dto.action === 'block') {
      await this.block(report.commentId, adminId, report.reason);
      report.status = 'resolved';
    } else if (dto.action === 'dismiss') {
      report.status = 'dismissed';
    } else {
      throw new BadRequestException('未知的处理操作');
    }

    report.resolvedBy = adminId;
    report.resolvedAt = Date.now();
    report.handleNote = dto.note;

    return this.reportRepo.save(report);
  }
}
