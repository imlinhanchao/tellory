import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { Play } from '../play/play.entity';
import { UsersService } from '../users/users.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockNotificationRepo: any;
  let mockPlayRepo: any;
  let mockUsersService: any;

  beforeEach(async () => {
    mockNotificationRepo = {
      create: jest.fn((dto: any) => ({
        ...dto,
        id: 'notif-uuid-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    mockPlayRepo = {
      createQueryBuilder: jest.fn(),
    };

    mockUsersService = {
      getUsers: jest.fn((ids: string[]) =>
        Promise.resolve(
          ids.map((id) => ({
            id,
            username: `user_${id}`,
            nickname: `Nick_${id}`,
            avatar: `https://example.com/avatar/${id}.png`,
          })),
        ),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(Play),
          useValue: mockPlayRepo,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  describe('notifyStoryComment', () => {
    it('should create notification for story author when commented by another user', async () => {
      const result = await service.notifyStoryComment({
        storyAuthorId: 'author-1',
        commenterId: 'commenter-2',
        storyId: 'story-1',
        storyTitle: 'Test Story',
        shortname: 'test-story',
        commentId: 'comment-1',
        commentContent: 'Great story!',
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'author-1',
          senderId: 'commenter-2',
          type: 'comment_story',
          title: '故事收到新评论',
          storyId: 'story-1',
          commentId: 'comment-1',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should include inline metadata in extra when commenting on an inline selection', async () => {
      await service.notifyStoryComment({
        storyAuthorId: 'author-1',
        commenterId: 'commenter-2',
        storyId: 'story-1',
        storyTitle: 'Test Story',
        shortname: 'test-story',
        commentId: 'comment-inline-1',
        commentContent: 'Inline comment text',
        isInline: true,
        sceneName: 'Chapter1',
        selectedText: 'selected sentence',
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          extra: expect.objectContaining({
            isInline: true,
            sceneName: 'Chapter1',
            selectedText: 'selected sentence',
          }),
        }),
      );
    });

    it('should not create notification if commenter is story author', async () => {
      const result = await service.notifyStoryComment({
        storyAuthorId: 'author-1',
        commenterId: 'author-1',
        storyId: 'story-1',
        storyTitle: 'Test Story',
        commentId: 'comment-1',
        commentContent: 'Self comment',
      });

      expect(result).toBeNull();
      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyCommentReply', () => {
    it('should create notification for target user when replied to', async () => {
      const result = await service.notifyCommentReply({
        targetUserId: 'user-parent',
        replierId: 'user-replier',
        storyId: 'story-1',
        storyTitle: 'Test Story',
        commentId: 'comment-2',
        replyContent: 'I agree with you!',
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-parent',
          senderId: 'user-replier',
          type: 'comment_reply',
          title: '评论收到新回复',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should include inline reply metadata in extra when replying to an inline comment', async () => {
      await service.notifyCommentReply({
        targetUserId: 'user-parent',
        replierId: 'user-replier',
        storyId: 'story-1',
        storyTitle: 'Test Story',
        commentId: 'comment-reply-1',
        replyContent: 'Reply to inline quote',
        isInline: true,
        isInlineReply: true,
        rootCommentId: 'comment-root-1',
        sceneName: 'Chapter1',
        selectedText: 'quoted text',
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          extra: expect.objectContaining({
            isInline: true,
            isInlineReply: true,
            rootCommentId: 'comment-root-1',
            sceneName: 'Chapter1',
            selectedText: 'quoted text',
          }),
        }),
      );
    });

    it('should not create notification if replier is the target user', async () => {
      const result = await service.notifyCommentReply({
        targetUserId: 'user-parent',
        replierId: 'user-parent',
        storyId: 'story-1',
        storyTitle: 'Test Story',
        commentId: 'comment-2',
        replyContent: 'Self reply',
      });

      expect(result).toBeNull();
      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyStoryUpdate', () => {
    it('should query active players without endings and create notifications', async () => {
      const mockPlayQb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { userId: 'player-1' },
          { userId: 'player-2' },
          { userId: 'author-user' }, // Should be excluded
        ]),
      };
      mockPlayRepo.createQueryBuilder.mockReturnValue(mockPlayQb);

      const count = await service.notifyStoryUpdate({
        storyId: 'story-1',
        storyTitle: 'Story Update Test',
        shortname: 'test-story',
        authorId: 'author-user',
        keys: ['story-1', 'test-story'],
      });

      expect(count).toBe(2);
      expect(mockNotificationRepo.create).toHaveBeenCalledTimes(2);
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'player-1',
          type: 'story_update',
          title: '正在玩的故事发布了更新',
        }),
      );
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'player-2',
          type: 'story_update',
          title: '正在玩的故事发布了更新',
        }),
      );
    });
  });

  describe('notifyStoryApproved', () => {
    it('should create notification for story author on approval', async () => {
      const result = await service.notifyStoryApproved({
        authorId: 'author-1',
        adminId: 'admin-1',
        storyId: 'story-1',
        storyTitle: 'Approved Story',
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'author-1',
          senderId: 'admin-1',
          type: 'story_approved',
          title: '故事审核通过',
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications with sender details', async () => {
      const mockNotifQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'n1',
              userId: 'user-1',
              senderId: 'user-sender',
              type: 'comment_story',
              title: '新评论',
              content: '评论内容',
              isRead: false,
              createdAt: 1000,
            },
          ],
          1,
        ]),
      };
      mockNotificationRepo.createQueryBuilder.mockReturnValue(mockNotifQb);
      mockNotificationRepo.count.mockResolvedValue(1);

      const res = await service.findAll('user-1', { page: 1, limit: 10 });

      expect(res.total).toBe(1);
      expect(res.unreadCount).toBe(1);
      expect(res.data[0].id).toBe('n1');
      expect(res.data[0].sender?.nickname).toBe('Nick_user-sender');
    });
  });

  describe('markAsRead and markAllAsRead', () => {
    it('should mark single notification as read', async () => {
      const notif = { id: 'n1', userId: 'user-1', isRead: false };
      mockNotificationRepo.findOne.mockResolvedValue(notif);

      const result = await service.markAsRead('n1', 'user-1');

      expect(result).toBe(true);
      expect(notif.isRead).toBe(true);
      expect(mockNotificationRepo.save).toHaveBeenCalledWith(notif);
    });

    it('should throw ForbiddenException if user does not own notification', async () => {
      const notif = { id: 'n1', userId: 'other-user', isRead: false };
      mockNotificationRepo.findOne.mockResolvedValue(notif);

      await expect(service.markAsRead('n1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should mark all unread notifications as read', async () => {
      const mockUpdateQb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      mockNotificationRepo.createQueryBuilder.mockReturnValue(mockUpdateQb);

      await service.markAllAsRead('user-1');

      expect(mockUpdateQb.set).toHaveBeenCalledWith({ isRead: true });
      expect(mockUpdateQb.where).toHaveBeenCalledWith(
        'userId = :userId AND isRead = :isRead',
        { userId: 'user-1', isRead: false },
      );
    });
  });

  describe('remove', () => {
    it('should delete notification if user is owner', async () => {
      const notif = { id: 'n1', userId: 'user-1' };
      mockNotificationRepo.findOne.mockResolvedValue(notif);

      const result = await service.remove('n1', 'user-1');

      expect(result).toBe(true);
      expect(mockNotificationRepo.delete).toHaveBeenCalledWith('n1');
    });
  });
});
