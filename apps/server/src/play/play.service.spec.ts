import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlayService } from './play.service';

describe('PlayService - Readers Progress', () => {
  let service: PlayService;
  let playRepo: any;
  let playUnlockRepo: any;
  let storiesService: any;
  let usersService: any;
  let storyRuntimeService: any;

  beforeEach(() => {
    playRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    playUnlockRepo = {
      find: jest.fn(),
    };
    storiesService = {
      findOne: jest.fn(),
      findApprovedOne: jest.fn(),
      findById: jest.fn(),
    };
    usersService = {
      getUsers: jest.fn(),
      findById: jest.fn(),
    };
    storyRuntimeService = {
      decodeDataset: jest.fn(),
    };

    service = new PlayService(
      playRepo,
      playUnlockRepo,
      storiesService,
      usersService,
      storyRuntimeService,
    );
  });

  describe('getStoryReadersProgress', () => {
    it('throws NotFoundException if story does not exist', async () => {
      storiesService.findOne.mockResolvedValue(null);
      storiesService.findApprovedOne.mockResolvedValue(null);

      await expect(
        service.getStoryReadersProgress('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if requesting user is neither author nor admin', async () => {
      storiesService.findOne.mockResolvedValue({
        id: 'story-1',
        authorId: 'author-user',
      });

      await expect(
        service.getStoryReadersProgress('story-1', 'other-user', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('merges multiple plays of the same reader into one card and returns play entrances & progress', async () => {
      const mockStory = {
        id: 'story-1',
        title: '测试故事',
        authorId: 'author-user',
        pointSize: 2,
        endSize: 1,
      };
      storiesService.findOne.mockResolvedValue(mockStory);

      // Reader 1 has 2 plays, Reader 2 has 1 play
      playRepo.find.mockResolvedValue([
        {
          id: 'play-1',
          storyId: 'story-1',
          userId: 'reader-1',
          currentPassage: '结局A',
          isEnding: true,
          createdAt: 1000,
          updatedAt: 2000,
          trace: [{ from: 'Start', to: '结局A', action: 'goto', at: 2000 }],
        },
        {
          id: 'play-2',
          storyId: 'story-1',
          userId: 'reader-1',
          currentPassage: '中途分支',
          isEnding: false,
          createdAt: 3000,
          updatedAt: 4000,
          history: [{ from: 'Start', to: '中途分支', action: 'goto', at: 4000 }],
        },
        {
          id: 'play-3',
          storyId: 'story-1',
          userId: 'reader-2',
          currentPassage: 'Start',
          isEnding: false,
          createdAt: 500,
          updatedAt: 600,
          trace: [],
        },
      ]);

      playUnlockRepo.find.mockResolvedValue([
        {
          playId: 'play-1',
          storyId: 'story-1',
          userId: 'reader-1',
          type: 'ending',
          name: '真结局',
          description: '达成真结局',
          unlockedAt: 2000,
        },
        {
          playId: 'play-1',
          storyId: 'story-1',
          userId: 'reader-1',
          type: 'achievement',
          name: '初次探索',
          description: '完成第一步',
          unlockedAt: 1500,
        },
      ]);

      usersService.getUsers.mockResolvedValue([
        {
          id: 'reader-1',
          username: 'readerone',
          nickname: '读者一号',
          avatar: 'https://avatar/1',
        },
        {
          id: 'reader-2',
          username: 'readertwo',
          nickname: '读者二号',
          avatar: 'https://avatar/2',
        },
      ]);

      const res = await service.getStoryReadersProgress('story-1', 'author-user', false);

      expect(res.story.id).toBe('story-1');
      expect(res.stats.totalReaders).toBe(2);
      expect(res.stats.totalPlays).toBe(3);
      expect(res.stats.completedPlays).toBe(1);
      expect(res.stats.inProgressPlays).toBe(2);

      // Reader 1 should merge play-1 and play-2 into one entry
      const reader1 = res.readers.find((r) => r.userId === 'reader-1');
      expect(reader1).toBeDefined();
      expect(reader1?.plays).toHaveLength(2);
      expect(reader1?.totalPlays).toBe(2);
      expect(reader1?.completedPlays).toBe(1);
      expect(reader1?.inProgressPlays).toBe(1);
      expect(reader1?.points).toHaveLength(1);
      expect(reader1?.end).toHaveLength(1);
      expect(reader1?.end[0].name).toBe('真结局');
      expect(reader1?.plays.find((p) => p.id === 'play-1')?.endingName).toBe('真结局');

      // Reader 2 has 1 play
      const reader2 = res.readers.find((r) => r.userId === 'reader-2');
      expect(reader2).toBeDefined();
      expect(reader2?.plays).toHaveLength(1);
    });

    it('allows admin access even if not author', async () => {
      storiesService.findOne.mockResolvedValue({
        id: 'story-1',
        authorId: 'author-user',
      });
      playRepo.find.mockResolvedValue([]);
      playUnlockRepo.find.mockResolvedValue([]);
      usersService.getUsers.mockResolvedValue([]);

      const res = await service.getStoryReadersProgress('story-1', 'admin-user', true);
      expect(res.story.id).toBe('story-1');
      expect(res.stats.totalReaders).toBe(0);
    });
  });

  describe('getStoryReaderPlayDetail', () => {
    it('throws ForbiddenException if requesting user is neither author nor admin', async () => {
      playRepo.findOne.mockResolvedValue({
        id: 'play-1',
        storyId: 'story-1',
        userId: 'reader-1',
      });
      storiesService.findById.mockResolvedValue({
        id: 'story-1',
        authorId: 'author-user',
      });

      await expect(
        service.getStoryReaderPlayDetail('story-1', 'play-1', 'other-user', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns play detail with user, decodedDataset, trace, and sibling plays', async () => {
      playRepo.findOne.mockResolvedValue({
        id: 'play-1',
        storyId: 'story-1',
        userId: 'reader-1',
        currentPassage: 'PassageA',
        isEnding: false,
        createdAt: 1000,
        updatedAt: 2000,
        dataset: 'encrypted-dataset',
        variables: { hp: 100 },
        trace: [{ from: 'Start', to: 'PassageA', action: 'goto', at: 2000 }],
      });

      storiesService.findById.mockResolvedValue({
        id: 'story-1',
        title: '测试故事',
        authorId: 'author-user',
      });

      usersService.findById.mockResolvedValue({
        id: 'reader-1',
        username: 'readerone',
        nickname: '读者一号',
      });

      storyRuntimeService.decodeDataset.mockReturnValue({
        title: '测试故事',
        passages: [{ name: 'Start' }, { name: 'PassageA' }],
      });

      playUnlockRepo.find.mockResolvedValue([]);

      playRepo.find.mockResolvedValue([
        {
          id: 'play-1',
          currentPassage: 'PassageA',
          isEnding: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          id: 'play-0',
          currentPassage: '结局',
          isEnding: true,
          createdAt: 500,
          updatedAt: 800,
        },
      ]);

      const res = await service.getStoryReaderPlayDetail('story-1', 'play-1', 'author-user', false);

      expect(res.id).toBe('play-1');
      expect(res.user?.nickname).toBe('读者一号');
      expect(res.decodedDataset?.title).toBe('测试故事');
      expect(res.trace).toHaveLength(1);
      expect(res.readerPlays).toHaveLength(2);
    });
  });
});
