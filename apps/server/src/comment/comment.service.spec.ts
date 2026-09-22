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
import { PlayService } from '../play/play.service';
import { NotificationService } from '../notification/notification.service';

describe('CommentService', () => {
  let service: CommentService;
  let mockCommentRepo: any;
  let mockReportRepo: any;
  let mockUsersService: any;
  let mockStoriesService: any;
  let mockPlayService: any;
  let mockNotificationService: any;

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
            {
              id: 'approved-1',
              sourceStoryId: 'valid-story-id',
              authorId: 'story-author-user',
              content:
                ':: scene_cabin\nHere is a chest.\n\n:: scene_auto\n你身上有 $gold 金币和 $hp 点生命值。\n[[继续|Next]]',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      getStorysByIds: jest.fn((ids: string[]) => {
        if (ids.includes('valid-story-id') || ids.includes('draft-story-id')) {
          return Promise.resolve([
            {
              id: ids[0],
              title: 'Test Story',
              authorId: 'story-author-user',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      findById: jest.fn((id: string) =>
        Promise.resolve({
          id,
          content:
            ':: scene_auto\n你身上有 $gold 金币和 $hp 点生命值。\n[[继续|Next]]',
        }),
      ),
    };

    mockPlayService = {
      findLatestByStoryId: jest.fn().mockResolvedValue({
        id: 'play-uuid-1',
        storyId: 'valid-story-id',
        userId: 'user-1',
        passage: 'scene_auto',
        variables: { gold: 50, hp: 90, irrelevant: 'ignored' },
      }),
    };

    mockNotificationService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      notifyStoryComment: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      notifyCommentReply: jest.fn().mockResolvedValue({ id: 'notif-2' }),
      notifyStoryUpdate: jest.fn().mockResolvedValue(1),
      notifyStoryApproved: jest.fn().mockResolvedValue({ id: 'notif-3' }),
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
        {
          provide: PlayService,
          useValue: mockPlayService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
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
        },
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

    it('should automatically generate scene variable snapshot and infer sceneName from play when omitted', async () => {
      mockStoriesService.getApprovedByIds.mockResolvedValueOnce([
        {
          id: 'valid-story-id',
          sourceStoryId: 'valid-story-id',
          content: `:: scene_auto
你身上有 $gold 金币和 $hp 点生命值。
[[继续|Next]]`,
        },
      ]);

      const result = await service.create('user-1', {
        storyId: 'valid-story-id',
        content: 'Auto snapshot extraction test',
        position: {
          start: 5,
          end: 20,
          selectedText: '金币和生命值',
        },
      });

      expect(mockPlayService.findLatestByStoryId).toHaveBeenCalledWith(
        'valid-story-id',
        'user-1',
      );
      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          position: {
            sceneName: 'scene_auto',
            start: 5,
            end: 20,
            selectedText: '金币和生命值',
            variableSnapshot: {
              gold: 50,
              hp: 90,
            },
          },
        }),
      );
      expect(result.position?.sceneName).toBe('scene_auto');
      expect(result.position?.variableSnapshot).toEqual({
        gold: 50,
        hp: 90,
      });
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

    it('should create comment with isAuthorOnly true', async () => {
      await service.create('user-1', {
        storyId: 'valid-story-id',
        content: 'Secret comment for author',
        isAuthorOnly: true,
      });

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: 'valid-story-id',
          userId: 'user-1',
          content: 'Secret comment for author',
          isAuthorOnly: true,
        }),
      );
    });

    it('should inherit isAuthorOnly from parent comment when replying', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'author-only-root',
        storyId: 'valid-story-id',
        userId: 'user-1',
        content: 'Author only root comment',
        parentId: null,
        isDeleted: false,
        isAuthorOnly: true,
      });

      await service.create('user-author', {
        storyId: 'valid-story-id',
        content: 'Author response to secret comment',
        parentId: 'author-only-root',
        isAuthorOnly: false,
      });

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'author-only-root',
          isAuthorOnly: true,
        }),
      );
    });

    it('should call notifyStoryComment when root story comment is created', async () => {
      await service.create('user-commenter', {
        storyId: 'valid-story-id',
        content: 'I love this story',
      });

      expect(mockNotificationService.notifyStoryComment).toHaveBeenCalledWith(
        expect.objectContaining({
          storyAuthorId: 'story-author-user',
          commenterId: 'user-commenter',
          storyId: 'valid-story-id',
          commentContent: 'I love this story',
        }),
      );
    });

    it('should call notifyCommentReply when comment reply is created', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'root-comment-id',
        storyId: 'valid-story-id',
        userId: 'user-parent',
        content: 'Original comment',
        parentId: null,
        isDeleted: false,
      });

      await service.create('user-replier', {
        storyId: 'valid-story-id',
        content: 'Replying to you',
        parentId: 'root-comment-id',
      });

      expect(mockNotificationService.notifyCommentReply).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'user-parent',
          replierId: 'user-replier',
          storyId: 'valid-story-id',
          replyContent: 'Replying to you',
        }),
      );
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

    it('should allow author or admin to update isAuthorOnly if no replies', async () => {
      const existing = {
        id: 'c1',
        userId: 'author-user',
        content: 'Original',
        isSpoiler: false,
        isAuthorOnly: false,
        isDeleted: false,
      };
      mockCommentRepo.findOne.mockResolvedValueOnce(existing);
      mockCommentRepo.count.mockResolvedValueOnce(0);

      const result = await service.update('c1', 'author-user', false, {
        isAuthorOnly: true,
      });

      expect(mockCommentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthorOnly: true,
        }),
      );
      expect(result.isAuthorOnly).toBe(true);
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
        getMany: jest.fn().mockResolvedValueOnce([
          {
            id: 'reply-1',
            storyId: 'valid-story-id',
            userId: 'user-2',
            content: 'Reply to Root 1',
            parentId: 'root-1',
            replyToUserId: 'user-1',
            isDeleted: false,
          },
        ]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.findAll({
        storyId: 'valid-story-id',
        tree: true,
      });

      expect(res.total).toBe(1);
      expect(res.data[0].id).toBe('root-1');
      expect(res.data[0].replies!.length).toBe(1);
      expect(res.data[0].replies![0].id).toBe('reply-1');
      expect(res.data[0].replyCount).toBe(1);
    });

    it('should filter selection comments by variable snapshot matching', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([
          [
            // Comment 1: no position (story level) -> always matches
            {
              id: 'c1',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Story level comment',
              position: null,
            },
            // Comment 2: matches reader variables { hasTorch: true }
            {
              id: 'c2',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Matching comment',
              position: {
                sceneName: 'cave',
                variableSnapshot: { hasTorch: true },
              },
            },
            // Comment 3: does NOT match reader variables (requires { hasTorch: false })
            {
              id: 'c3',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Unmatching comment',
              position: {
                sceneName: 'cave',
                variableSnapshot: { hasTorch: false },
              },
            },
          ],
          3,
        ]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      // Reader has { hasTorch: true }
      const res = await service.findAll({
        storyId: 'valid-story-id',
        variables: JSON.stringify({ hasTorch: true }),
      });

      expect(res.data.length).toBe(2);
      expect(res.data.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('should filter selection comments by currentSceneName and variable snapshot in comment list', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([
          [
            // Comment 1: Story level comment -> retained
            {
              id: 'story-comm-1',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Story level comment',
              position: null,
            },
            // Comment 2: Matches currentSceneName 'cave' and variables { hp: 100 } -> retained
            {
              id: 'match-scene-vars',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Matching cave comment',
              position: {
                sceneName: 'cave',
                variableSnapshot: { hp: 100 },
              },
            },
            // Comment 3: Belongs to different scene 'forest' -> filtered out
            {
              id: 'other-scene-comm',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Forest scene comment',
              position: {
                sceneName: 'forest',
                variableSnapshot: { hp: 100 },
              },
            },
            // Comment 4: Belongs to 'cave', but requires { hp: 50 } -> filtered out
            {
              id: 'mismatched-vars-comm',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Low hp cave comment',
              position: {
                sceneName: 'cave',
                variableSnapshot: { hp: 50 },
              },
            },
          ],
          4,
        ]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.findAll({
        storyId: 'valid-story-id',
        currentSceneName: 'cave',
        variables: JSON.stringify({ hp: 100 }),
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        "(comment.position IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(comment.position, '$.sceneName')) = :currentSceneName)",
        { currentSceneName: 'cave' },
      );
      expect(res.data.length).toBe(2);
      expect(res.data.map((c) => c.id)).toEqual([
        'story-comm-1',
        'match-scene-vars',
      ]);
    });

    it('should query comments without position when hasPosition is false', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([
          [
            {
              id: 'story-comm-only',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Only story level comment',
              position: null,
            },
          ],
          1,
        ]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.findAll({
        storyId: 'valid-story-id',
        hasPosition: false,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('comment.position IS NULL');
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe('story-comm-only');
    });

    it('should still filter other scene selection comments even when isAdmin is true', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([
          [
            {
              id: 'c-story',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Story comment',
              position: null,
            },
            {
              id: 'c-cave',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Cave comment',
              position: { sceneName: 'cave', variableSnapshot: {} },
            },
            {
              id: 'c-forest',
              storyId: 'valid-story-id',
              userId: 'user-1',
              content: 'Forest comment',
              position: { sceneName: 'forest', variableSnapshot: {} },
            },
          ],
          3,
        ]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.findAll(
        {
          storyId: 'valid-story-id',
          currentSceneName: 'cave',
        },
        true, // isAdmin = true
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        "(comment.position IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(comment.position, '$.sceneName')) = :currentSceneName)",
        { currentSceneName: 'cave' },
      );
      expect(res.data.length).toBe(2);
      expect(res.data.map((c) => c.id)).toEqual(['c-story', 'c-cave']);
    });

    it('should filter out isAuthorOnly comments for ordinary unauthorized reader in findAll', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([[], 0]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(
        { storyId: 'valid-story-id' },
        false,
        'user-reader',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(comment.isAuthorOnly = :authFalse OR comment.userId = :currentUserId)',
        { authFalse: false, currentUserId: 'user-reader' },
      );
    });

    it('should allow story author to see isAuthorOnly comments in findAll without restriction', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([[], 0]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(
        { storyId: 'valid-story-id' },
        false,
        'story-author-user',
      );

      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('comment.isAuthorOnly = :authFalse'),
        expect.anything(),
      );
    });

    it('should allow admin to see isAuthorOnly comments in findAll without restriction', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([[], 0]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({ storyId: 'valid-story-id' }, true, 'admin-user');

      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('comment.isAuthorOnly = :authFalse'),
        expect.anything(),
      );
    });

    it('should throw NotFoundException when unauthorized reader accesses author-only comment in findOne', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'secret-c1',
        storyId: 'valid-story-id',
        userId: 'creator-user',
        content: 'Secret comment',
        isAuthorOnly: true,
        isDeleted: false,
      });

      await expect(
        service.findOne('secret-c1', false, 'unauthorized-reader'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow comment creator to access author-only comment in findOne', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'secret-c1',
        storyId: 'valid-story-id',
        userId: 'creator-user',
        content: 'Secret comment',
        isAuthorOnly: true,
        isDeleted: false,
      });
      mockCommentRepo.find.mockResolvedValueOnce([]);

      const result = await service.findOne('secret-c1', false, 'creator-user');
      expect(result.id).toBe('secret-c1');
    });

    it('should allow story author to access author-only comment in findOne', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'secret-c1',
        storyId: 'valid-story-id',
        userId: 'creator-user',
        content: 'Secret comment',
        isAuthorOnly: true,
        isDeleted: false,
      });
      mockCommentRepo.find.mockResolvedValueOnce([]);

      const result = await service.findOne(
        'secret-c1',
        false,
        'story-author-user',
      );
      expect(result.id).toBe('secret-c1');
    });

    it('should allow admin to access author-only comment in findOne', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 'secret-c1',
        storyId: 'valid-story-id',
        userId: 'creator-user',
        content: 'Secret comment',
        isAuthorOnly: true,
        isDeleted: false,
      });
      mockCommentRepo.find.mockResolvedValueOnce([]);

      const result = await service.findOne('secret-c1', true, 'admin-user');
      expect(result.id).toBe('secret-c1');
    });
  });

  describe('getSceneCommentCounts', () => {
    it('should aggregate comment counts and spoiler counts by sceneName', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([
          { id: '1', position: { sceneName: 'intro' }, isSpoiler: false },
          { id: '2', position: { sceneName: 'intro' }, isSpoiler: true },
          { id: '3', position: { sceneName: 'chapter_1' }, isSpoiler: false },
          { id: '4', position: null, isSpoiler: false },
        ]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const counts = await service.getSceneCommentCounts('valid-story-id');

      expect(counts).toEqual({
        intro: { total: 2, spoilers: 1 },
        chapter_1: { total: 1, spoilers: 0 },
      });
    });

    it('should filter out author-only comments from scene count for unauthorized reader', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.getSceneCommentCounts(
        'valid-story-id',
        'reader-user',
        false,
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(comment.isAuthorOnly = :authFalse OR comment.userId = :currentUserId)',
        { authFalse: false, currentUserId: 'reader-user' },
      );
    });

    it('should include author-only comments in scene count for story author or admin', async () => {
      const mockQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([]),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.getSceneCommentCounts(
        'valid-story-id',
        'story-author-user',
        false,
      );

      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('comment.isAuthorOnly = :authFalse'),
        expect.anything(),
      );
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
        {
          id: 'user-reporter',
          username: 'reporter',
          nickname: 'Reporter Nick',
        },
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

      const res = await service.findReports({
        status: 'pending',
        page: 1,
        limit: 10,
      });

      expect(res.total).toBe(1);
      expect(res.data[0].id).toBe('rep-1');
      expect(res.data[0].reporter?.nickname).toBe('Reporter Nick');
      expect(res.data[0].comment?.content).toBe('Offensive comment');
      expect(res.data[0].comment?.author?.nickname).toBe('Author Nick');
    });
  });
});
