import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CommentReport } from './comment-report.entity';
import { UsersService } from '../users/users.service';
import { StoriesService } from '../stories/stories.service';

describe('CommentService', () => {
  let service: CommentService;
  let mockCommentRepo: any;
  let mockReportRepo: any;
  let mockUsersService: any;
  let mockStoriesService: any;

  beforeEach(async () => {
    mockCommentRepo = {
      create: jest.fn((dto: Record<string, unknown>) => ({
        ...dto,
        id: 'comment-uuid-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({
          ...entity,
          id: entity.id || 'comment-uuid-1',
        }),
      ),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockReportRepo = {
      create: jest.fn((dto: Record<string, unknown>) => ({
        ...dto,
        id: 'report-uuid-1',
        createdAt: Date.now(),
      })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({
          ...entity,
          id: entity.id || 'report-uuid-1',
        }),
      ),
      findOne: jest.fn(),
      find: jest.fn(),
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

    mockStoriesService = {
      getApprovedByIds: jest.fn((ids: string[]) => {
        if (ids.includes('valid-story-id')) {
          return Promise.resolve([
            { id: 'approved-1', sourceStoryId: 'valid-story-id' },
          ]);
        }
        return Promise.resolve([]);
      }),
      getStorysByIds: jest.fn((ids: string[]) => {
        if (ids.includes('valid-story-id') || ids.includes('draft-story-id')) {
          return Promise.resolve([{ id: ids[0], title: 'Test Story' }]);
        }
        return Promise.resolve([]);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentRepo,
        },
        {
          provide: getRepositoryToken(CommentReport),
          useValue: mockReportRepo,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: StoriesService,
          useValue: mockStoriesService,
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  describe('create comment', () => {
    it('should throw NotFoundException if story does not exist', async () => {
      await expect(
        service.create('user-1', {
          storyId: 'non-existent-story',
          content: 'Hello world',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a standard story comment', async () => {
      const result = await service.create('user-1', {
        storyId: 'valid-story-id',
        content: 'This is a great story!',
        isSpoiler: false,
      });

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: 'valid-story-id',
          userId: 'user-1',
          content: 'This is a great story!',
          isSpoiler: false,
          position: null,
          parentId: undefined,
        }),
      );
      expect(result.author).toEqual({
        id: 'user-1',
        username: 'user_user-1',
        nickname: 'Nick_user-1',
        avatar: 'https://example.com/avatar/user-1.png',
      });
    });

    it('should create a selection comment with position (start, end, sceneName, variableSnapshot)', async () => {
      const result = await service.create('user-1', {
        storyId: 'valid-story-id',
        content: 'This line is a plot twist!',
        isSpoiler: true,
        position: {
          sceneName: 'scene_cabin',
          start: 45,
          end: 120,
          selectedText: 'You opened the wooden chest.',
          variableSnapshot: { hp: 100, hasKey: true },
        },
      });

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: 'valid-story-id',
          userId: 'user-1',
          content: 'This line is a plot twist!',
          isSpoiler: true,
          position: {
            sceneName: 'scene_cabin',
            start: 45,
            end: 120,
            selectedText: 'You opened the wooden chest.',
            variableSnapshot: { hp: 100, hasKey: true },
          },
        }),
      );
      expect(result.isSpoiler).toBe(true);
      expect(result.position?.sceneName).toBe('scene_cabin');
      expect(result.position?.variableSnapshot).toEqual({
        hp: 100,
        hasKey: true,
      });
    });

    it('should support offset aliases and normalize inverted start/end', async () => {
      await service.create('user-1', {
        storyId: 'valid-story-id',
        content: 'Backward selected text comment',
        position: {
          passageName: 'scene_intro',
          startOffset: 150,
          endOffset: 50,
          variables: { score: 10 },
        } as any,
      });

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          position: {
            sceneName: 'scene_intro',
            start: 50,
            end: 150,
            variableSnapshot: { score: 10 },
            selectedText: undefined,
          },
        }),
      );
    });

    it('should create a reply to a root comment', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'root-comment-id',
        storyId: 'valid-story-id',
        userId: 'user-root',
        content: 'Root comment',
        parentId: null,
        isDeleted: false,
      });

      const result = await service.create('user-2', {
        storyId: 'valid-story-id',
        content: 'I agree with this!',
        parentId: 'root-comment-id',
      });

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'root-comment-id',
          replyToId: 'root-comment-id',
          replyToUserId: 'user-root',
        }),
      );
      expect(result.replyToUser?.id).toBe('user-root');
    });

    it('should flatten nested reply to thread root', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'child-reply-id',
        storyId: 'valid-story-id',
        userId: 'user-2',
        parentId: 'root-comment-id',
        isDeleted: false,
      });

      await service.create('user-3', {
        storyId: 'valid-story-id',
        content: 'Replying to user 2 under root thread',
        parentId: 'child-reply-id',
      });

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'root-comment-id',
          replyToId: 'child-reply-id',
          replyToUserId: 'user-2',
        }),
      );
    });

    it('should throw BadRequestException if replying to a blocked comment', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'blocked-comment-id',
        storyId: 'valid-story-id',
        userId: 'user-2',
        isDeleted: false,
        isBlocked: true,
      });

      await expect(
        service.create('user-3', {
          storyId: 'valid-story-id',
          content: 'Replying to blocked comment',
          parentId: 'blocked-comment-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update comment', () => {
    it('should throw ForbiddenException if user is not author and not admin', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'c1',
        userId: 'author-user',
        isDeleted: false,
      });

      await expect(
        service.update('c1', 'other-user', false, { content: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if comment already has replies', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'c1',
        userId: 'author-user',
        content: 'Original',
        isSpoiler: false,
        isDeleted: false,
      });
      mockCommentRepo.count.mockResolvedValueOnce(2);

      await expect(
        service.update('c1', 'author-user', false, {
          content: 'Trying to update',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow author or admin to update content and isSpoiler if no replies', async () => {
      const existing = {
        id: 'c1',
        userId: 'author-user',
        content: 'Original',
        isSpoiler: false,
        isDeleted: false,
      };
      mockCommentRepo.findOne.mockResolvedValueOnce(existing);
      mockCommentRepo.count.mockResolvedValueOnce(0);

      const result = await service.update('c1', 'author-user', false, {
        content: 'Updated content',
        isSpoiler: true,
      });

      expect(mockCommentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Updated content',
          isSpoiler: true,
        }),
      );
      expect(result.content).toBe('Updated content');
      expect(result.isSpoiler).toBe(true);
    });
  });

  describe('remove comment', () => {
    it('should throw BadRequestException if comment has replies', async () => {
      const existing = {
        id: 'c1',
        userId: 'author-user',
        content: 'Original',
        isDeleted: false,
      };
      mockCommentRepo.findOne.mockResolvedValueOnce(existing);
      mockCommentRepo.count.mockResolvedValueOnce(1);

      await expect(service.remove('c1', 'author-user', false)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockCommentRepo.delete).not.toHaveBeenCalled();
    });

    it('should delete comment if it has no replies', async () => {
      const existing = {
        id: 'c1',
        userId: 'author-user',
        content: 'Original',
        isDeleted: false,
      };
      mockCommentRepo.findOne.mockResolvedValueOnce(existing);
      mockCommentRepo.count.mockResolvedValueOnce(0);

      const result = await service.remove('c1', 'author-user', false);

      expect(result.softDeleted).toBe(false);
      expect(mockCommentRepo.delete).toHaveBeenCalledWith('c1');
    });
  });

  describe('findAll and findOne', () => {
    it('should find one comment and attach its replies', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'c1',
        storyId: 'valid-story-id',
        userId: 'user-1',
        content: 'Root comment',
        isSpoiler: false,
        isDeleted: false,
      });
      mockCommentRepo.find.mockResolvedValueOnce([
        {
          id: 'c2',
          storyId: 'valid-story-id',
          userId: 'user-2',
          content: 'Child reply',
          parentId: 'c1',
          replyToUserId: 'user-1',
          isSpoiler: false,
          isDeleted: false,
        },
      ]);

      const result = await service.findOne('c1');

      expect(result.id).toBe('c1');
      expect(result.author?.id).toBe('user-1');
      expect(result.replies?.length).toBe(1);
      expect(result.replies?.[0].author?.id).toBe('user-2');
      expect(result.replyCount).toBe(1);
    });

    it('should support tree mode in findAll', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([
          [
            {
              id: 'root-1',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Root 1',
              parentId: null,
              isDeleted: false,
            },
          ],
          1,
        ]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockCommentRepo.find.mockResolvedValueOnce([
        {
          id: 'reply-1',
          storyId: 'valid-story-id',
          userId: 'user-2',
          content: 'Reply to Root 1',
          parentId: 'root-1',
          replyToUserId: 'user-1',
          isDeleted: false,
        },
      ]);

      const res = await service.findAll({
        storyId: 'valid-story-id',
        tree: true,
      });

      expect(res.total).toBe(1);
      expect(res.data[0].id).toBe('root-1');
      expect(res.data[0].replies.length).toBe(1);
      expect(res.data[0].replies[0].id).toBe('reply-1');
      expect(res.data[0].replyCount).toBe(1);
    });
  });

  describe('getSceneCommentCounts', () => {
    it('should aggregate comment counts and spoiler counts by sceneName', async () => {
      mockCommentRepo.find.mockResolvedValueOnce([
        { id: '1', position: { sceneName: 'intro' }, isSpoiler: false },
        { id: '2', position: { sceneName: 'intro' }, isSpoiler: true },
        { id: '3', position: { sceneName: 'chapter_1' }, isSpoiler: false },
        { id: '4', position: null, isSpoiler: false },
      ]);

      const counts = await service.getSceneCommentCounts('valid-story-id');

      expect(counts).toEqual({
        intro: { total: 2, spoilers: 1 },
        chapter_1: { total: 1, spoilers: 0 },
      });
    });
  });

  describe('block and unblock comment', () => {
    it('should allow admin to block comment and mask content for non-admin', async () => {
      const existing = {
        id: 'c1',
        storyId: 's1',
        userId: 'u1',
        content: 'Bad content',
        isBlocked: false,
        isDeleted: false,
      };
      mockCommentRepo.findOne.mockResolvedValueOnce(existing);

      const blocked = await service.block('c1', 'admin-1', '不当言论');

      expect(mockCommentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isBlocked: true,
          blockReason: '不当言论',
          blockedBy: 'admin-1',
        }),
      );
      expect(blocked.isBlocked).toBe(true);
      expect(blocked.content).toBe('Bad content'); // Admin gets original content
      expect(blocked.blockReason).toBe('不当言论');
    });

    it('should mask content as [该评论已被管理员屏蔽] when viewed by non-admin', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'c1',
        storyId: 's1',
        userId: 'u1',
        content: 'Bad content',
        isBlocked: true,
        blockReason: '违规',
        isDeleted: false,
      });
      mockCommentRepo.find.mockResolvedValueOnce([]);

      const result = await service.findOne('c1', false);

      expect(result.content).toBe('[该评论已被管理员屏蔽]');
      expect(result.blockReason).toBeUndefined();
    });

    it('should allow admin to unblock comment', async () => {
      const existing = {
        id: 'c1',
        storyId: 's1',
        userId: 'u1',
        content: 'Original content',
        isBlocked: true,
        blockReason: '误封',
        isDeleted: false,
      };
      mockCommentRepo.findOne.mockResolvedValueOnce(existing);

      const unblocked = await service.unblock('c1');

      expect(mockCommentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isBlocked: false,
          blockReason: undefined,
        }),
      );
      expect(unblocked.isBlocked).toBe(false);
    });
  });

  describe('report comment and report management', () => {
    it('should allow user to report a comment', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'c1',
        storyId: 'story-1',
        content: 'Offensive content',
        isDeleted: false,
      });
      mockReportRepo.findOne.mockResolvedValueOnce(null);

      const report = await service.report('c1', 'reporter-1', {
        reason: '垃圾广告',
        description: '包含推广链接',
      });

      expect(mockReportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          commentId: 'c1',
          storyId: 'story-1',
          reporterId: 'reporter-1',
          reason: '垃圾广告',
          description: '包含推广链接',
          status: 'pending',
        }),
      );
      expect(report.id).toBe('report-uuid-1');
    });

    it('should throw BadRequestException if user already reported the same comment', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'c1',
        storyId: 'story-1',
        content: 'Offensive content',
        isDeleted: false,
      });
      mockReportRepo.findOne.mockResolvedValueOnce({
        id: 'existing-report',
        status: 'pending',
      });

      await expect(
        service.report('c1', 'reporter-1', {
          reason: '垃圾广告',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow admin to resolve report with block action', async () => {
      mockReportRepo.findOne.mockResolvedValueOnce({
        id: 'report-1',
        commentId: 'c1',
        reason: '违规推广',
        status: 'pending',
      });
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'c1',
        storyId: 's1',
        userId: 'u1',
        content: 'Promo link',
        isBlocked: false,
        isDeleted: false,
      });

      const result = await service.resolveReport('report-1', 'admin-1', {
        action: 'block',
        note: '经核实确实违规',
      });

      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe('admin-1');
      expect(result.handleNote).toBe('经核实确实违规');
    });

    it('should allow admin to resolve report with dismiss action', async () => {
      mockReportRepo.findOne.mockResolvedValueOnce({
        id: 'report-2',
        commentId: 'c1',
        reason: '误报',
        status: 'pending',
      });

      const result = await service.resolveReport('report-2', 'admin-1', {
        action: 'dismiss',
        note: '未见违规情况',
      });

      expect(result.status).toBe('dismissed');
      expect(result.resolvedBy).toBe('admin-1');
      expect(result.handleNote).toBe('未见违规情况');
    });

    it('should find reports with pagination and details', async () => {
      const mockQb: any = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([
          [
            {
              id: 'rep-1',
              commentId: 'c1',
              storyId: 's1',
              reporterId: 'user-reporter',
              reason: '垃圾广告',
              status: 'pending',
              createdAt: 123456789,
            },
          ],
          1,
        ]),
      };
      mockReportRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockUsersService.getUsers.mockResolvedValueOnce([
        { id: 'user-reporter', username: 'reporter', nickname: 'Reporter Nick' },
      ]);
      mockCommentRepo.find.mockResolvedValueOnce([
        {
          id: 'c1',
          storyId: 's1',
          userId: 'user-author',
          content: 'Offensive comment',
          isDeleted: false,
          isBlocked: false,
        },
      ]);
      // getUsers called by attachUserDetails
      mockUsersService.getUsers.mockResolvedValueOnce([
        { id: 'user-author', username: 'author', nickname: 'Author Nick' },
      ]);

      const res = await service.findReports({ status: 'pending', page: 1, limit: 10 });

      expect(res.total).toBe(1);
      expect(res.data[0].id).toBe('rep-1');
      expect(res.data[0].reporter?.nickname).toBe('Reporter Nick');
      expect(res.data[0].comment?.content).toBe('Offensive comment');
      expect(res.data[0].comment?.author?.nickname).toBe('Author Nick');
    });
  });
});
