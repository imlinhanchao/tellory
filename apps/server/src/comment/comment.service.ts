import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
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
import { PlayService } from '../play/play.service';
import { NotificationService } from '../notification/notification.service';
import { parseStorySource } from 'tellory';
import { extractSceneReferencedVariables } from './comment-variable.util';

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
  isAuthorOnly: boolean;
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
    @Optional()
    private readonly playService?: PlayService,
    @Optional()
    private readonly notificationService?: NotificationService,
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
   * 获取故事作者ID
   */
  async getStoryAuthorId(storyId: string): Promise<string | null> {
    try {
      const approved = await this.storiesService.getApprovedByIds([storyId]);
      if (approved && approved.length > 0 && approved[0].authorId) {
        return approved[0].authorId;
      }
      const stories = await this.storiesService.getStorysByIds([storyId]);
      if (stories && stories.length > 0 && stories[0].authorId) {
        return stories[0].authorId;
      }
      const s =
        (await this.storiesService.findById(storyId, true)) ||
        (await this.storiesService.findById(storyId, false));
      if (s?.authorId) return s.authorId;
    } catch (err) {
      console.warn('[CommentService] getStoryAuthorId failed:', err);
    }
    return null;
  }

  /**
   * 规范化并自动解析划词评论位置及变量快照
   */
  private async resolveAndNormalizePosition(
    storyId: string,
    userId: string,
    position?: CreateCommentDto['position'],
  ): Promise<CommentPosition | null> {
    if (!position) return null;

    let sceneName = position.sceneName || position.passageName;

    let play: any = null;
    if (this.playService) {
      try {
        play = await this.playService.findLatestByStoryId(storyId, userId);
      } catch (err) {
        console.warn('[CommentService] findLatestByStoryId failed:', err);
      }
    }

    if (!sceneName && (play?.currentPassage || play?.passage)) {
      sceneName = play.currentPassage || play.passage;
    }

    if (!sceneName) {
      throw new BadRequestException(
        '划词评论必须包含场景名称或需先进入场景游玩',
      );
    }

    const rawStart = position.start ?? position.startOffset ?? 0;
    const rawEnd = position.end ?? position.endOffset ?? 0;
    const start = Math.min(rawStart, rawEnd);
    const end = Math.max(rawStart, rawEnd);

    let variableSnapshot =
      position.variableSnapshot ?? position.variables ?? null;

    // 若前端或调用方未显式传入非空快照，则由后端从 story 与 play 自动提取该场景所依赖的变量快照
    if (!variableSnapshot || Object.keys(variableSnapshot).length === 0) {
      variableSnapshot = await this.generateSceneVariableSnapshot(
        storyId,
        sceneName,
        play?.variables || {},
      );
    }

    return {
      sceneName,
      start,
      end,
      variableSnapshot,
      selectedText: position.selectedText,
    };
  }

  /**
   * 基于场景与故事文本，提取所引用的所有变量并生成快照
   */
  async generateSceneVariableSnapshot(
    storyId: string,
    sceneName: string,
    currentVariables: Record<string, any> = {},
  ): Promise<Record<string, any>> {
    try {
      let storyContent: string | null = null;
      const approvedList = await this.storiesService.getApprovedByIds([
        storyId,
      ]);
      if (approvedList && approvedList.length > 0 && approvedList[0].content) {
        storyContent = approvedList[0].content;
      } else {
        const storyList = await this.storiesService.getStorysByIds([storyId]);
        if (storyList && storyList.length > 0 && storyList[0].content) {
          storyContent = storyList[0].content;
        } else {
          const direct =
            (await this.storiesService.findById?.(storyId, true)) ||
            (await this.storiesService.findById?.(storyId, false));
          storyContent = direct?.content || null;
        }
      }

      if (!storyContent) {
        return {};
      }

      const parsed = parseStorySource(storyContent);
      if (!parsed?.passages) {
        return {};
      }

      const targetPassage = parsed.passages.find((p) => p.name === sceneName);
      if (!targetPassage || !targetPassage.content) {
        return {};
      }

      const referencedVars = extractSceneReferencedVariables(
        targetPassage.content,
        parsed.passages,
        new Set([sceneName]),
      );

      const snapshot: Record<string, any> = {};
      for (const varName of referencedVars) {
        snapshot[varName] =
          currentVariables[varName] !== undefined
            ? currentVariables[varName]
            : 0;
      }
      return snapshot;
    } catch (err) {
      console.warn(
        '[CommentService] generateSceneVariableSnapshot failed:',
        err,
      );
      return {};
    }
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

      let parsedPosition = c.position;
      if (typeof parsedPosition === 'string') {
        try {
          parsedPosition = JSON.parse(parsedPosition);
        } catch {
          parsedPosition = null;
        }
      }

      return {
        ...c,
        author,
        replyToUser,
        content: displayContent,
        position: parsedPosition,
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

    let isAuthorOnly = Boolean(dto.isAuthorOnly);

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
      if (parent.isAuthorOnly) {
        isAuthorOnly = true;
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

    const normalizedPosition = await this.resolveAndNormalizePosition(
      dto.storyId,
      userId,
      dto.position,
    );

    const comment = this.commentRepo.create({
      storyId: dto.storyId,
      userId,
      content: dto.content,
      parentId: parentId || undefined,
      replyToId: replyToId || undefined,
      replyToUserId: replyToUserId || undefined,
      isSpoiler: Boolean(dto.isSpoiler),
      isAuthorOnly,
      position: normalizedPosition,
      isDeleted: false,
      isBlocked: false,
    });

    const saved = await this.commentRepo.save(comment);
    const [detailed] = await this.attachUserDetails([saved]);

    // 发送站内通知（捕获异常避免影响评论创建）
    await this.sendCommentNotification(saved, userId).catch((err) => {
      console.error('发送评论通知失败:', err);
    });

    return detailed;
  }

  /**
   * 发送评论/回复相关的站内信通知
   */
  private async sendCommentNotification(
    comment: Comment,
    commenterId: string,
  ): Promise<void> {
    if (!this.notificationService) return;

    try {
      let storyTitle = '故事';
      let shortname: string | undefined;
      const approved = await this.storiesService.getApprovedByIds([
        comment.storyId,
      ]);
      if (approved && approved.length > 0) {
        storyTitle = approved[0].title || '未命名故事';
        shortname = approved[0].shortname;
      } else {
        const stories = await this.storiesService.getStorysByIds([
          comment.storyId,
        ]);
        if (stories && stories.length > 0) {
          storyTitle = stories[0].title || '未命名故事';
          shortname = stories[0].shortname;
        }
      }

      if (!comment.parentId) {
        // 1. 有人评论了自己的故事（根评论，包括常规故事评论与划词评论）
        let pos: any = comment.position;
        if (typeof pos === 'string') {
          try {
            pos = JSON.parse(pos);
          } catch {
            pos = null;
          }
        }
        const isInline = Boolean(pos && pos.selectedText);
        const sceneName = pos?.sceneName;
        const selectedText = pos?.selectedText;

        const storyAuthorId = await this.getStoryAuthorId(comment.storyId);
        if (storyAuthorId && storyAuthorId !== commenterId) {
          await this.notificationService.notifyStoryComment({
            storyAuthorId,
            commenterId,
            storyId: comment.storyId,
            storyTitle,
            shortname,
            commentId: comment.id,
            commentContent: comment.content,
            isInline,
            sceneName,
            selectedText,
          });
        }
      } else if (
        comment.replyToUserId &&
        comment.replyToUserId !== commenterId
      ) {
        // 2. 回复了自己的评论
        let rootComment: Comment | null = null;
        if (comment.parentId) {
          rootComment = await this.commentRepo.findOne({
            where: { id: comment.parentId },
          });
        }
        let pos: any = rootComment?.position;
        if (typeof pos === 'string') {
          try {
            pos = JSON.parse(pos);
          } catch {
            pos = null;
          }
        }
        const isInline = Boolean(pos && pos.selectedText);
        const sceneName = pos?.sceneName;
        const selectedText = pos?.selectedText;
        const rootCommentId = rootComment?.id;

        await this.notificationService.notifyCommentReply({
          targetUserId: comment.replyToUserId,
          replierId: commenterId,
          storyId: comment.storyId,
          storyTitle,
          shortname,
          commentId: comment.id,
          replyContent: comment.content,
          isInline,
          isInlineReply: isInline,
          rootCommentId,
          sceneName,
          selectedText,
        });
      }
    } catch (err) {
      console.error('处理评论通知失败:', err);
    }
  }

  /**
   * 查询评论列表
   */
  async findAll(
    query: QueryCommentsDto,
    isAdmin = false,
    currentUserId?: string,
  ) {
    const {
      storyId,
      sceneName,
      currentSceneName,
      parentId,
      hasPosition,
      tree,
      includeSpoilers = true,
      isAuthorOnly,
      includeBlocked,
      limit = 20,
      page = 1,
      createdAt,
    } = query;

    const storyAuthorId = await this.getStoryAuthorId(storyId);
    const isStoryAuthor = Boolean(
      storyAuthorId && currentUserId && currentUserId === storyAuthorId,
    );
    const canViewAllAuthorOnly = isAdmin || isStoryAuthor;

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

    // 作者可见过滤
    if (isAuthorOnly !== undefined) {
      if (isAuthorOnly === true) {
        if (canViewAllAuthorOnly) {
          qb.andWhere('comment.isAuthorOnly = :authOnly', { authOnly: true });
        } else if (currentUserId) {
          qb.andWhere(
            'comment.isAuthorOnly = :authOnly AND comment.userId = :currentUserId',
            { authOnly: true, currentUserId },
          );
        } else {
          qb.andWhere('1 = 0');
        }
      } else {
        qb.andWhere('comment.isAuthorOnly = :authOnly', { authOnly: false });
      }
    } else if (!canViewAllAuthorOnly) {
      if (currentUserId) {
        qb.andWhere(
          '(comment.isAuthorOnly = :authFalse OR comment.userId = :currentUserId)',
          { authFalse: false, currentUserId },
        );
      } else {
        qb.andWhere('comment.isAuthorOnly = :authFalse', { authFalse: false });
      }
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

    const validCurrentSceneName =
      currentSceneName &&
      currentSceneName !== 'undefined' &&
      currentSceneName !== 'null'
        ? currentSceneName
        : undefined;

    if (validSceneName) {
      qb.andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(comment.position, '$.sceneName')) = :sceneName",
        { sceneName: validSceneName },
      );
    } else if (validCurrentSceneName) {
      // 评论列表中的划词评论，过滤掉不属于当前场景的评论（常规故事评论 comment.position IS NULL 予以保留）
      qb.andWhere(
        "(comment.position IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(comment.position, '$.sceneName')) = :currentSceneName)",
        { currentSceneName: validCurrentSceneName },
      );
    }

    let readerVariables: Record<string, any> | null = null;
    if (query.variables) {
      try {
        readerVariables =
          typeof query.variables === 'string'
            ? JSON.parse(query.variables)
            : query.variables;
      } catch {
        // ignore json parse error
      }
    }

    const targetScene = validSceneName || validCurrentSceneName;

    const matchesVariables = (c: Comment | CommentWithDetails): boolean => {
      // 常规故事评论（无划词位置）直接保留
      if (!c.position) return true;

      let pos = c.position;
      if (typeof pos === 'string') {
        try {
          pos = JSON.parse(pos);
        } catch {
          return false;
        }
      }

      // 划词评论：必须属于当前场景（若指定了 targetScene）
      if (targetScene && pos.sceneName !== targetScene) {
        return false;
      }

      // 划词评论：必须匹配变量快照
      const snapshot = pos.variableSnapshot || (pos as any).variables;
      if (!snapshot || Object.keys(snapshot).length === 0) {
        return true;
      }
      if (!readerVariables) {
        return false;
      }
      for (const [key, expectedVal] of Object.entries(snapshot)) {
        const actualVal =
          readerVariables[key] !== undefined ? readerVariables[key] : 0;
        const normExpected = expectedVal !== undefined ? expectedVal : 0;
        if (JSON.stringify(actualVal) !== JSON.stringify(normExpected)) {
          return false;
        }
      }
      return true;
    };

    const shouldFilter = readerVariables !== null || targetScene !== undefined;

    if (tree) {
      // 树形模式：仅分页查询根评论（parentId 为 NULL），然后聚合各自的回复
      qb.andWhere('comment.parentId IS NULL');
      qb.orderBy('comment.createdAt', 'DESC');
      qb.skip((page - 1) * limit).take(limit);

      const [rootComments, total] = await qb.getManyAndCount();
      const detailedRoots = await this.attachUserDetails(rootComments, isAdmin);
      const filteredRoots = shouldFilter
        ? detailedRoots.filter(matchesVariables)
        : detailedRoots;

      const rootIds = filteredRoots.map((r) => r.id);
      let repliesByParent: Record<string, CommentWithDetails[]> = {};

      if (rootIds.length > 0) {
        const replyQb = this.commentRepo.createQueryBuilder('comment');
        replyQb.where('comment.parentId IN (:...rootIds)', { rootIds });
        replyQb.orderBy('comment.createdAt', 'ASC');

        if (!canViewAllAuthorOnly) {
          const myRootIds = filteredRoots
            .filter((r) => r.userId === currentUserId)
            .map((r) => r.id);

          if (currentUserId && myRootIds.length > 0) {
            replyQb.andWhere(
              '(comment.isAuthorOnly = :authFalse OR comment.userId = :currentUserId OR comment.parentId IN (:...myRootIds))',
              { authFalse: false, currentUserId, myRootIds },
            );
          } else if (currentUserId) {
            replyQb.andWhere(
              '(comment.isAuthorOnly = :authFalse OR comment.userId = :currentUserId)',
              { authFalse: false, currentUserId },
            );
          } else {
            replyQb.andWhere('comment.isAuthorOnly = :authFalse', {
              authFalse: false,
            });
          }
        }

        const replies = await replyQb.getMany();
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

      const data = filteredRoots.map((root) => {
        const replies = repliesByParent[root.id] || [];
        return {
          ...root,
          replies,
          replyCount: replies.length,
        };
      });

      return {
        data,
        total: shouldFilter ? filteredRoots.length : total,
        page,
        limit,
      };
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
    const filteredData = shouldFilter ? data.filter(matchesVariables) : data;

    return {
      data: filteredData,
      total: shouldFilter ? filteredData.length : total,
      page,
      limit,
    };
  }

  /**
   * 查询单条评论及其所有回复
   */
  async findOne(
    id: string,
    isAdmin = false,
    currentUserId?: string,
  ): Promise<CommentWithDetails> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    if (comment.isAuthorOnly) {
      const storyAuthorId = await this.getStoryAuthorId(comment.storyId);
      const isStoryAuthor = Boolean(
        storyAuthorId && currentUserId && currentUserId === storyAuthorId,
      );
      if (!isAdmin && !isStoryAuthor && currentUserId !== comment.userId) {
        throw new NotFoundException('评论不存在');
      }
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
    if (dto.isAuthorOnly !== undefined) {
      comment.isAuthorOnly = dto.isAuthorOnly;
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
    currentUserId?: string,
    isAdmin = false,
  ): Promise<Record<string, { total: number; spoilers: number }>> {
    const storyAuthorId = await this.getStoryAuthorId(storyId);
    const isStoryAuthor = Boolean(
      storyAuthorId && currentUserId && currentUserId === storyAuthorId,
    );
    const canViewAll = isAdmin || isStoryAuthor;

    const qb = this.commentRepo.createQueryBuilder('comment');
    qb.where('comment.storyId = :storyId', { storyId });
    qb.andWhere('comment.isDeleted = :isDeleted', { isDeleted: false });
    qb.andWhere('comment.isBlocked = :isBlocked', { isBlocked: false });
    qb.andWhere('comment.position IS NOT NULL');

    if (!canViewAll) {
      if (currentUserId) {
        qb.andWhere(
          '(comment.isAuthorOnly = :authFalse OR comment.userId = :currentUserId)',
          { authFalse: false, currentUserId },
        );
      } else {
        qb.andWhere('comment.isAuthorOnly = :authFalse', { authFalse: false });
      }
    }

    const comments = await qb
      .select(['comment.id', 'comment.position', 'comment.isSpoiler'])
      .getMany();

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
