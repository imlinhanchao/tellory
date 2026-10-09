import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Play } from './play.entity';
import { omit } from 'src/utils';
import { PlayUnlock } from './play.unlock.entity';
import { PlayStoryDto } from './play.dto';
import { StoriesService } from '../stories/stories.service';
import { StoryRuntimeService } from '../stories/story-runtime.service';
import { parseStorySource } from 'tellory';
import { User } from 'src/users/user.entity';
import { UsersService } from 'src/users/users.service';
import { Story } from 'src/stories/story.entity';

type AdminPlayQuery = {
  page?: number;
  limit?: number;
  createdAt?: number;
  storyId?: string;
  userId?: string;
};

@Injectable()
export class PlayService {
  constructor(
    @InjectRepository(Play) private playRepo: Repository<Play>,
    @InjectRepository(PlayUnlock)
    private playUnlockRepo: Repository<PlayUnlock>,
    private readonly storiesService: StoriesService,
    private readonly usersService: UsersService,
    private readonly storyRuntimeService: StoryRuntimeService,
  ) {}

  async create(payload: Partial<Play>): Promise<Play> {
    const entity = this.playRepo.create({
      ...payload,
      variables: payload.variables ?? {},
      history: payload.history ?? [],
      trace: payload.trace ?? [],
    });
    const saved = await this.playRepo.save(entity);
    return saved;
  }

  async findLatestByStoryId(
    storyId: string,
    userId: string,
  ): Promise<Play | null> {
    const playRecord = await this.playRepo.findOne({
      where: { storyId, userId, isEnding: false },
      order: { createdAt: 'DESC' },
    });
    if (playRecord) return playRecord;
    return this.playRepo.findOne({
      where: { storyId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Play | null> {
    return this.playRepo.findOne({ where: { id } });
  }

  async update(id: string, patch: Partial<Play>): Promise<Play | null> {
    const existing = await this.findOne(id);
    if (!existing) return null;
    Object.assign(
      existing,
      omit(patch, ['id', 'storyId', 'userId', 'createdAt', 'updatedAt']),
    );
    await this.playRepo.update(existing.id, existing);
    return existing;
  }

  async remove(id: string): Promise<void> {
    await this.playRepo.delete(id);
  }

  async createUnlock(payload: PlayUnlock): Promise<PlayUnlock> {
    const unlock = await this.playUnlockRepo.findOne({
      where: {
        storyId: payload.storyId,
        userId: payload.userId,
        type: payload.type,
        name: payload.name,
      },
    });
    if (unlock) {
      return unlock;
    }
    const entity = this.playUnlockRepo.create(payload);
    const saved = await this.playUnlockRepo.save(entity);
    return saved;
  }

  async getUserUnlocksGrouped(
    userId: string,
    includePrivate = false,
  ): Promise<PlayStoryDto[]> {
    const rows = await this.playUnlockRepo.find({ where: { userId } });
    const map = new Map<string, { points: any[]; end: any[] }>();
    for (const r of rows) {
      const entry = map.get(r.storyId) || { points: [], end: [] };
      if (r.type === 'achievement')
        entry.points.push({ name: r.name, description: r.description });
      else if (r.type === 'ending')
        entry.end.push({ name: r.name, description: r.description });
      map.set(r.storyId, entry);
    }
    const plays = await this.playRepo
      .createQueryBuilder('play')
      .select('play.storyId', 'storyId')
      .distinct(true)
      .where('play.userId = :userId', { userId })
      .getRawMany();
    for (const play of plays) {
      if (map.has(play.storyId)) continue;
      const entry = map.get(play.storyId) || { points: [], end: [] };
      map.set(play.storyId, entry);
    }
    const out: PlayStoryDto[] = [];
    const storyIds = Array.from(map.keys());
    const storys = includePrivate
      ? await this.storiesService.getStorysByIds(storyIds)
      : [];
    const approvedStories =
      await this.storiesService.getApprovedByIds(storyIds);

    // Batch fetch latest plays for these stories to determine isPlaying
    const latestPlays = storyIds.length
      ? await this.playRepo.find({
          where: { userId, storyId: In(storyIds) },
          order: { createdAt: 'DESC' },
        })
      : [];
    const latestByStory = new Map<string, Play>();
    for (const p of latestPlays) {
      if (!latestByStory.has(p.storyId)) latestByStory.set(p.storyId, p);
    }

    for (const [storyId, v] of map.entries()) {
      const story =
        storys.find((s) => s.id === storyId) ||
        approvedStories.find((s) => s.sourceStoryId === storyId);
      if (!story) continue;
      const latest = latestByStory.get(storyId);
      const isPlaying = !!latest && !latest.isEnding;
      const playInfo = latest
        ? {
            id: latest.id,
            currentPassage: latest.currentPassage,
            isEnding: latest.isEnding,
            createdAt: latest.createdAt,
            updatedAt: latest.updatedAt,
            history: latest.history || [],
            trace:
              latest.trace && latest.trace.length > 0
                ? latest.trace
                : (latest.history || []).map((h) => ({
                    from: h.from,
                    to: h.to,
                    action: h.action,
                    at: h.at,
                    type:
                      h.action === 'start'
                        ? ('start' as const)
                        : ('forward' as const),
                  })),
          }
        : null;

      out.push({
        ...(omit(story, ['content']) as Story),
        storyId,
        points: v.points,
        end: v.end,
        status: (story as Story).status || 'published',
        isPlaying,
        play: playInfo,
      });
    }
    return out;
  }

  async getReaders(storyId: string, userId: string): Promise<Partial<User>[]> {
    const p: { userId: string }[] = await this.playRepo
      .createQueryBuilder('play')
      .select('play.userId', 'userId')
      .distinct(true)
      .where('play.storyId = :storyId', { storyId })
      .getRawMany();
    const userIds = p.filter((p) => p.userId !== userId).map((p) => p.userId);
    const readers = await this.usersService.getUsers(userIds);
    return readers.map((r) => omit(r, User.unsafeKey));
  }

  async listForAdmin(query: AdminPlayQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const take = Math.max(1, Math.min(Number(query.limit) || 20, 100));
    const createdAt = Number(query.createdAt) || Date.now();
    const skip = (page - 1) * take;

    const qb = this.playRepo
      .createQueryBuilder('play')
      // 排除 html / dataset 大字段，仅列表展示用不到
      .select([
        'play.id',
        'play.storyId',
        'play.userId',
        'play.currentPassage',
        'play.isEnding',
        'play.createdAt',
        'play.updatedAt',
      ])
      .where('play.createdAt <= :createdAt', { createdAt })
      .orderBy('play.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (query.storyId) {
      qb.andWhere('play.storyId = :storyId', { storyId: query.storyId });
    }
    if (query.userId) {
      qb.andWhere('play.userId = :userId', { userId: query.userId });
    }

    const [rows, total] = await qb.getManyAndCount();
    const storyIds = Array.from(
      new Set(rows.map((row) => row.storyId).filter(Boolean)),
    );
    const userIds = Array.from(
      new Set(rows.map((row) => row.userId).filter(Boolean)),
    ) as string[];

    const stories = storyIds.length
      ? await this.storiesService.getStorysByIds(storyIds)
      : [];
    const users = userIds.length
      ? await this.usersService.getUsers(userIds)
      : [];

    const data = rows.map((row) => {
      const story = stories.find((s) => s.id === row.storyId);
      const user = users.find((u) => u.id === row.userId);
      return {
        ...row,
        story: story
          ? {
              id: story.id,
              title: story.title,
              shortname: story.shortname,
              authorId: story.authorId,
              status: story.status,
            }
          : null,
        user: user
          ? {
              id: user.id,
              username: user.username,
              nickname: user.nickname,
              avatar: user.avatar,
              from: user.from,
            }
          : null,
      };
    });

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  async getStoryReadersProgress(
    storyIdOrName: string,
    requestingUserId: string,
    isAdmin = false,
  ) {
    let story: any = await this.storiesService.findOne(storyIdOrName);
    if (!story) {
      story = await this.storiesService.findApprovedOne(storyIdOrName);
    }
    if (!story) {
      throw new NotFoundException('故事不存在');
    }

    const isAuthor = story.authorId === requestingUserId;
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('仅故事作者或管理员可访问读者阅读进度');
    }

    const storyIds = new Set<string>();
    if (story.id) storyIds.add(story.id);
    if (story.shortname) storyIds.add(story.shortname);
    if (story.sourceStoryId) storyIds.add(story.sourceStoryId);

    const targetStoryIds = Array.from(storyIds);

    const plays = await this.playRepo.find({
      where: { storyId: In(targetStoryIds) },
      order: { updatedAt: 'DESC' },
    });

    const unlocks = await this.playUnlockRepo.find({
      where: { storyId: In(targetStoryIds) },
      order: { unlockedAt: 'ASC' },
    });

    const userIds = Array.from(
      new Set([
        ...plays.map((p) => p.userId).filter(Boolean),
        ...unlocks.map((u) => u.userId).filter(Boolean),
      ]),
    ) as string[];

    const users = userIds.length ? await this.usersService.getUsers(userIds) : [];
    const userMap = new Map<string, Partial<User>>();
    for (const u of users) {
      userMap.set(u.id, omit(u, User.unsafeKey));
    }

    const readerMap = new Map<
      string,
      {
        userId: string | null;
        user: Partial<User> | null;
        plays: any[];
        points: any[];
        end: any[];
        latestActiveAt: number;
      }
    >();

    for (const userId of userIds) {
      const user = userMap.get(userId) || null;
      readerMap.set(userId, {
        userId,
        user,
        plays: [],
        points: [],
        end: [],
        latestActiveAt: 0,
      });
    }

    for (const u of unlocks) {
      if (!u.userId) continue;
      const reader = readerMap.get(u.userId);
      if (!reader) continue;
      if (u.type === 'achievement') {
        if (!reader.points.some((p) => p.name === u.name)) {
          reader.points.push({
            name: u.name,
            description: u.description,
            unlockedAt: u.unlockedAt,
          });
        }
      } else if (u.type === 'ending') {
        if (!reader.end.some((e) => e.name === u.name)) {
          reader.end.push({
            name: u.name,
            description: u.description,
            unlockedAt: u.unlockedAt,
          });
        }
      }
    }

    for (const p of plays) {
      const uId = p.userId || '__anonymous__';
      let reader = readerMap.get(uId);
      if (!reader) {
        reader = {
          userId: p.userId || null,
          user: null,
          plays: [],
          points: [],
          end: [],
          latestActiveAt: 0,
        };
        readerMap.set(uId, reader);
      }

      const stepCount =
        p.trace && p.trace.length > 0
          ? p.trace.length
          : p.history && p.history.length > 0
            ? p.history.length
            : 0;

      const playEnding = unlocks.find(
        (u) => u.playId === p.id && u.type === 'ending',
      );

      const playSummary = {
        id: p.id,
        storyId: p.storyId,
        currentPassage: p.currentPassage,
        isEnding: p.isEnding,
        createdAt: Number(p.createdAt),
        updatedAt: Number(p.updatedAt),
        stepCount,
        endingName: playEnding?.name || null,
      };

      reader.plays.push(playSummary);
      if (Number(p.updatedAt) > reader.latestActiveAt) {
        reader.latestActiveAt = Number(p.updatedAt);
      }
    }

    const readers = Array.from(readerMap.values())
      .filter(
        (r) => r.plays.length > 0 || r.points.length > 0 || r.end.length > 0,
      )
      .map((r) => {
        r.plays.sort((a, b) => b.updatedAt - a.updatedAt);
        const completedPlays = r.plays.filter((p) => p.isEnding).length;
        const inProgressPlays = r.plays.filter((p) => !p.isEnding).length;
        return {
          userId: r.userId,
          user: r.user,
          points: r.points,
          end: r.end,
          plays: r.plays,
          latestActiveAt: r.latestActiveAt || (r.plays[0]?.updatedAt ?? 0),
          totalPlays: r.plays.length,
          completedPlays,
          inProgressPlays,
        };
      })
      .sort((a, b) => b.latestActiveAt - a.latestActiveAt);

    const totalPlays = plays.length;
    const completedPlays = plays.filter((p) => p.isEnding).length;
    const inProgressPlays = plays.filter((p) => !p.isEnding).length;

    return {
      story: {
        id: story.id,
        title: story.title,
        shortname: story.shortname,
        authorId: story.authorId,
        status: story.status || 'published',
        pointSize: story.pointSize ?? 0,
        endSize: story.endSize ?? 0,
        passageSize: story.passageSize ?? 0,
      },
      stats: {
        totalReaders: readers.length,
        totalPlays,
        completedPlays,
        inProgressPlays,
      },
      readers,
    };
  }

  async getStoryReaderPlayDetail(
    storyIdOrName: string,
    playId: string,
    requestingUserId: string,
    isAdmin = false,
  ) {
    const play = await this.playRepo.findOne({ where: { id: playId } });
    if (!play) {
      throw new NotFoundException('游玩记录不存在');
    }

    let story: any = await this.storiesService.findById(play.storyId, false);
    if (!story) {
      story = await this.storiesService.findById(storyIdOrName, false);
    }
    if (!story) {
      story = await this.storiesService.findApprovedOne(play.storyId);
    }
    if (!story) {
      story = await this.storiesService.findApprovedOne(storyIdOrName);
    }
    if (!story) {
      throw new NotFoundException('故事不存在');
    }

    const isAuthor = story.authorId === requestingUserId;
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('仅故事作者或管理员可访问读者游玩记录');
    }

    let user: Partial<User> | null = null;
    if (play.userId) {
      const rawUser = await this.usersService.findById(play.userId);
      if (rawUser) {
        user = omit(rawUser, User.unsafeKey);
      }
    }

    let decodedDataset = this.storyRuntimeService.decodeDataset(
      play.dataset || '',
    );
    if (!decodedDataset && story.content) {
      try {
        const parsed = parseStorySource(story.content);
        decodedDataset = {
          title: parsed.title,
          startPassage: parsed.startPassage,
          passages: parsed.passages,
        };
      } catch {
        // ignore
      }
    }

    const trace =
      play.trace && play.trace.length > 0
        ? play.trace
        : (play.history || []).map((h) => ({
            from: h.from,
            to: h.to,
            action: h.action,
            at: h.at,
            type:
              h.action === 'start' ? ('start' as const) : ('forward' as const),
          }));

    const playUnlocks = await this.playUnlockRepo.find({
      where: { playId: play.id },
    });

    const userUnlocks = play.userId
      ? await this.playUnlockRepo.find({
          where: { userId: play.userId, storyId: play.storyId },
        })
      : [];

    let siblingPlays: any[] = [];
    if (play.userId) {
      const allUserPlays = await this.playRepo.find({
        where: { userId: play.userId, storyId: play.storyId },
        select: {
          id: true,
          currentPassage: true,
          isEnding: true,
          createdAt: true,
          updatedAt: true,
          trace: true,
          history: true,
        },
        order: { createdAt: 'DESC' },
      });
      siblingPlays = allUserPlays.map((sp) => ({
        id: sp.id,
        currentPassage: sp.currentPassage,
        isEnding: sp.isEnding,
        createdAt: Number(sp.createdAt),
        updatedAt: Number(sp.updatedAt),
        stepCount:
          sp.trace && sp.trace.length > 0
            ? sp.trace.length
            : sp.history && sp.history.length > 0
              ? sp.history.length
              : 0,
      }));
    }

    return {
      ...play,
      createdAt: Number(play.createdAt),
      updatedAt: Number(play.updatedAt),
      trace,
      user,
      story: {
        id: story.id,
        title: story.title,
        shortname: story.shortname,
        authorId: story.authorId,
        status: story.status || 'published',
        pointSize: story.pointSize ?? 0,
        endSize: story.endSize ?? 0,
        passageSize: story.passageSize ?? 0,
      },
      decodedDataset,
      playUnlocks,
      userUnlocks,
      readerPlays: siblingPlays,
    };
  }
}
