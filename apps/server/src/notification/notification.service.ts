import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { Play } from '../play/play.entity';
import { UsersService } from '../users/users.service';
import {
  QueryNotificationsDto,
  NotificationWithSender,
  NotificationSenderInfo,
} from './notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Play)
    private readonly playRepo: Repository<Play>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 创建一条通知
   */
  async create(payload: Partial<Notification>): Promise<Notification> {
    const entity = this.notificationRepo.create({
      ...payload,
      isRead: false,
    });
    return this.notificationRepo.save(entity);
  }

  /**
   * 1. 有人评论了自己的故事
   */
  async notifyStoryComment(params: {
    storyAuthorId: string;
    commenterId: string;
    storyId: string;
    storyTitle: string;
    shortname?: string;
    commentId: string;
    commentContent: string;
    isInline?: boolean;
    sceneName?: string;
    selectedText?: string;
  }): Promise<Notification | null> {
    const {
      storyAuthorId,
      commenterId,
      storyId,
      storyTitle,
      shortname,
      commentId,
      commentContent,
      isInline,
      sceneName,
      selectedText,
    } = params;

    // 不给自己发送通知
    if (!storyAuthorId || storyAuthorId === commenterId) {
      return null;
    }

    let senderName = '有人';
    try {
      const [sender] = await this.usersService.getUsers([commenterId]);
      if (sender) {
        senderName = sender.nickname || sender.username || '有人';
      }
    } catch {
      // 容错处理
    }

    const preview = commentContent.replace(/\s+/g, ' ').slice(0, 60);

    return this.create({
      userId: storyAuthorId,
      senderId: commenterId,
      type: 'comment_story',
      title: '故事收到新评论',
      content: `${senderName} 评论了你的故事《${storyTitle}》：“${preview}”`,
      storyId,
      commentId,
      extra: {
        storyTitle,
        shortname,
        commentContent,
        isInline: Boolean(isInline),
        sceneName,
        selectedText,
      },
    });
  }

  /**
   * 2. 回复了自己的评论
   */
  async notifyCommentReply(params: {
    targetUserId: string;
    replierId: string;
    storyId: string;
    storyTitle: string;
    shortname?: string;
    commentId: string;
    replyContent: string;
    isInline?: boolean;
    isInlineReply?: boolean;
    rootCommentId?: string;
    sceneName?: string;
    selectedText?: string;
  }): Promise<Notification | null> {
    const {
      targetUserId,
      replierId,
      storyId,
      storyTitle,
      shortname,
      commentId,
      replyContent,
      isInline,
      isInlineReply,
      rootCommentId,
      sceneName,
      selectedText,
    } = params;

    // 不给自己发送通知
    if (!targetUserId || targetUserId === replierId) {
      return null;
    }

    let senderName = '有人';
    try {
      const [sender] = await this.usersService.getUsers([replierId]);
      if (sender) {
        senderName = sender.nickname || sender.username || '有人';
      }
    } catch {
      // 容错处理
    }

    const preview = replyContent.replace(/\s+/g, ' ').slice(0, 60);

    return this.create({
      userId: targetUserId,
      senderId: replierId,
      type: 'comment_reply',
      title: '评论收到新回复',
      content: `${senderName} 回复了你的评论：“${preview}”`,
      storyId,
      commentId,
      extra: {
        storyTitle,
        shortname,
        replyContent,
        isInline: Boolean(isInline),
        isInlineReply: Boolean(isInlineReply),
        rootCommentId,
        sceneName,
        selectedText,
      },
    });
  }

  /**
   * 3. 正在玩的故事发布了更新
   */
  async notifyStoryUpdate(params: {
    storyId: string;
    storyTitle: string;
    shortname?: string;
    authorId?: string;
    keys: string[];
  }): Promise<number> {
    try {
      const { storyId, storyTitle, shortname, authorId, keys } = params;
      const validKeys = Array.from(new Set(keys.filter(Boolean)));
      if (validKeys.length === 0) return 0;

      // 正在玩的故事：查询当前正在游玩此故事（isEnding = false）且有已登录账号的用户
      const activeRows = await this.playRepo
        .createQueryBuilder('play')
        .select('play.userId', 'userId')
        .where('play.storyId IN (:...validKeys)', { validKeys })
        .andWhere('play.isEnding = :isEnding', { isEnding: false })
        .andWhere('play.userId IS NOT NULL')
        .distinct(true)
        .getRawMany();

      const userIds = activeRows
        .map((r) => r.userId)
        .filter((uid) => uid && uid !== authorId);

      const uniqueUserIds = Array.from(new Set(userIds));
      if (uniqueUserIds.length === 0) return 0;

      const notifications = uniqueUserIds.map((userId) =>
        this.notificationRepo.create({
          userId,
          senderId: authorId,
          type: 'story_update',
          title: '正在玩的故事发布了更新',
          content: `你正在玩的故事《${storyTitle}》已发布新内容，快去看看吧！`,
          storyId,
          extra: {
            storyTitle,
            shortname,
          },
          isRead: false,
        }),
      );

      await this.notificationRepo.save(notifications);
      return notifications.length;
    } catch (e) {
      console.error('发送故事更新通知失败:', e);
      return 0;
    }
  }

  /**
   * 4. 故事审核通过
   */
  async notifyStoryApproved(params: {
    authorId: string;
    adminId?: string;
    storyId: string;
    storyTitle: string;
    shortname?: string;
  }): Promise<Notification | null> {
    const { authorId, adminId, storyId, storyTitle, shortname } = params;
    if (!authorId) return null;

    return this.create({
      userId: authorId,
      senderId: adminId,
      type: 'story_approved',
      title: '故事审核通过',
      content: `恭喜！你的故事《${storyTitle}》已通过审核并公开发布。`,
      storyId,
      extra: {
        storyTitle,
        shortname,
      },
    });
  }

  /**
   * 附加发送者用户详情
   */
  private async attachSenderDetails(
    notifications: Notification[],
  ): Promise<NotificationWithSender[]> {
    if (notifications.length === 0) return [];

    const senderIds = Array.from(
      new Set(
        notifications.map((n) => n.senderId).filter(Boolean) as string[],
      ),
    );

    let userMap = new Map<string, NotificationSenderInfo>();
    if (senderIds.length > 0) {
      try {
        const users = await this.usersService.getUsers(senderIds);
        userMap = new Map(
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
      } catch (err) {
        console.error('获取通知发送者详情失败:', err);
      }
    }

    return notifications.map((n) => ({
      ...n,
      sender: n.senderId ? userMap.get(n.senderId) : undefined,
    }));
  }

  /**
   * 分页查询当前用户的通知列表
   */
  async findAll(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<{
    data: NotificationWithSender[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const qb = this.notificationRepo.createQueryBuilder('notification');
    qb.where('notification.userId = :userId', { userId });

    if (query.isRead !== undefined) {
      qb.andWhere('notification.isRead = :isRead', { isRead: query.isRead });
    }

    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }

    qb.orderBy('notification.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    const data = await this.attachSenderDetails(rows);

    const unreadCount = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });

    return {
      data,
      total,
      unreadCount,
      page,
      limit,
    };
  }

  /**
   * 获取未读通知总数
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * 标记单条通知为已读
   */
  async markAsRead(id: string, userId: string): Promise<boolean> {
    const item = await this.notificationRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('通知不存在');
    }
    if (item.userId !== userId) {
      throw new ForbiddenException('无权操作该通知');
    }

    if (!item.isRead) {
      item.isRead = true;
      await this.notificationRepo.save(item);
    }
    return true;
  }

  /**
   * 标记当前用户所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('userId = :userId AND isRead = :isRead', {
        userId,
        isRead: false,
      })
      .execute();
  }

  /**
   * 删除单条通知
   */
  async remove(id: string, userId: string): Promise<boolean> {
    const item = await this.notificationRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('通知不存在');
    }
    if (item.userId !== userId) {
      throw new ForbiddenException('无权操作该通知');
    }

    await this.notificationRepo.delete(id);
    return true;
  }
}
