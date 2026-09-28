import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PlayService } from './play.service';
import { UpdatePlayDto } from './play.dto';
import { IPlayTrace } from './play.entity';
import { StoriesService } from '../stories/stories.service';
import { StoryRuntimeService } from '../stories/story-runtime.service';
import { parseStorySource } from 'tellory';

@Controller('play')
export class PlayController {
  private readonly playService: PlayService;
  private readonly storiesService: StoriesService;
  private readonly storyRuntimeService: StoryRuntimeService;

  constructor(
    playService: PlayService,
    storiesService: StoriesService,
    storyRuntimeService: StoryRuntimeService,
  ) {
    this.playService = playService;
    this.storiesService = storiesService;
    this.storyRuntimeService = storyRuntimeService;
  }

  @UseGuards(OptionalAuthGuard)
  @Get('unlocks/:userId')
  async getUserUnlocks(@Param('userId') userId: string, @Request() req) {
    return await this.playService.getUserUnlocksGrouped(
      userId,
      req.user?.userId == userId || req.user?.isAdmin || false,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-history')
  async getMyHistory(@Request() req) {
    return await this.playService.getUserUnlocksGrouped(req.user.userId, true);
  }

  @UseGuards(JwtAuthGuard)
  @Get('trace/:identifier')
  async getPlayTrace(@Param('identifier') identifier: string, @Request() req) {
    const userId = req.user?.userId;
    const isAdmin = req.user?.isAdmin;
    let play = await this.playService.findOne(identifier);

    if (play) {
      if (play.userId !== userId && !isAdmin) {
        throw new Error('无权访问该游玩记录');
      }
    } else {
      play = await this.playService.findLatestByStoryId(identifier, userId);
    }

    if (!play) {
      throw new Error('未找到相关的游玩记录');
    }

    // 优先从 play.dataset 中解析出当时游玩的故事完整场景与状态（支持未发布/内测故事）
    let decodedDataset: any = null;
    if (play.dataset) {
      decodedDataset = this.storyRuntimeService.decodeDataset(play.dataset);
    }

    // 若 dataset 缺失则从故事源回退加载
    if (!decodedDataset && play.storyId) {
      const story = await this.storiesService.findById(play.storyId, false);
      if (story?.content) {
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

    return {
      playId: play.id,
      storyId: play.storyId,
      currentPassage: play.currentPassage,
      isEnding: play.isEnding,
      trace,
      history: play.history || [],
      decodedDataset,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('reader/:storyId')
  async getReader(@Param('storyId') storyId: string, @Request() req) {
    return this.playService.getReaders(storyId, req.user?.userId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/list')
  async adminList(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('createdAt') createdAt?: number,
    @Query('storyId') storyId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.playService.listForAdmin({
      page,
      limit,
      createdAt,
      storyId,
      userId,
    });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/:playId')
  async adminDetail(@Param('playId') playId: string) {
    const play = await this.playService.findOne(playId);
    if (!play) {
      throw new Error('游玩记录不存在');
    }
    const story = play.storyId
      ? await this.storiesService.findById(play.storyId, false)
      : null;
    const decodedDataset = this.storyRuntimeService.decodeDataset(
      play.dataset || '',
    );
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
    return {
      ...play,
      trace,
      story: story
        ? {
            id: story.id,
            title: story.title,
            shortname: story.shortname,
            authorId: story.authorId,
            status: story.status,
          }
        : null,
      decodedDataset,
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:playId')
  async adminRemove(@Param('playId') playId: string) {
    const play = await this.playService.findOne(playId);
    if (!play) {
      throw new Error('游玩记录不存在');
    }
    await this.playService.remove(playId);
    return { ok: true };
  }

  @Get('story/:id')
  @UseGuards(JwtAuthGuard)
  async getApprovedStory(@Param('id') id: string, @Request() req) {
    const p = await this.storiesService.findApprovedOne(id);
    if (!p) {
      throw new Error('故事不存在');
    }
    // 附加喜爱状态（阅读页展示喜爱按钮）
    const likeState = await this.storiesService.getStoryLikeState(
      p.sourceStoryId || id,
      req.user?.userId,
    );
    return { ...p, ...likeState };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id')
  async createPlay(@Param('id') id: string, @Request() req) {
    const userId = req.user?.userId;
    const story = await this.storiesService.findOne(id);
    if (!story) throw new Error('故事不存在');

    const lastPlay = await this.playService.findLatestByStoryId(id, userId);
    if (lastPlay?.isEnding === false) {
      const canAccessVariables =
        lastPlay.userId === userId ||
        story.authorId === userId ||
        req.user?.isAdmin ||
        false;
      return {
        ...lastPlay,
        currentPassage: lastPlay.currentPassage,
        passage: lastPlay.currentPassage,
        html: lastPlay.html,
        history: lastPlay.history || [],
        trace: lastPlay.trace || [],
        variables: canAccessVariables ? lastPlay.variables : {},
      };
    }

    const runtime = this.storyRuntimeService.start(story.id, story.content);
    const initialTrace: IPlayTrace[] = [
      {
        from: '',
        to: runtime.passage,
        action: 'start',
        at: Date.now(),
        type: 'start',
      },
    ];
    const payload = {
      storyId: id,
      userId: userId,
      currentPassage: runtime.passage,
      variables: runtime.variables || {},
      history: [
        {
          from: '',
          to: runtime.passage,
          action: 'start',
          at: Date.now(),
          variables: runtime.variables || {},
        },
      ],
      trace: initialTrace,
      dataset: runtime.dataset,
      html: runtime.html,
    };
    const created = await this.playService.create(payload);
    const canAccessVariables =
      created.userId === userId ||
      story.authorId === userId ||
      req.user?.isAdmin ||
      false;
    return {
      ...created,
      currentPassage: runtime.passage,
      passage: runtime.passage,
      html: created.html,
      history: [],
      trace: created.trace || initialTrace,
      variables: canAccessVariables ? created.variables : {},
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getPlay(@Param('id') id: string, @Request() req) {
    const p = await this.playService.findLatestByStoryId(id, req.user?.userId);
    if (!p || p.storyId !== id) return null;
    const isAuthorOrAdmin =
      p.userId === req.user?.userId || req.user?.isAdmin || false;
    return {
      ...p,
      currentPassage: p.currentPassage,
      passage: p.currentPassage,
      variables: isAuthorOrAdmin ? p.variables || {} : {},
      history: p.history || [],
      trace: p.trace || [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updatePlay(
    @Param('id') id: string,
    @Body() dto: UpdatePlayDto,
    @Request() req,
  ) {
    const p = await this.playService.findLatestByStoryId(id, req.user?.userId);
    if (!p || p.storyId !== id) return null;
    if (p.userId && p.userId !== req.user.userId)
      throw new Error('无权修改该游玩记录');
    const isAuthorOrAdmin =
      p.userId === req.user?.userId || req.user?.isAdmin || false;

    if (dto.back) {
      const prevHistory = p.history || [];
      if (prevHistory.length <= 1) {
        return {
          ...p,
          variables: isAuthorOrAdmin ? p.variables || {} : {},
          history: prevHistory,
          trace: p.trace || [],
        };
      }

      const rollbackHistory = prevHistory.slice(0, -1);
      const rollbackTo = rollbackHistory[rollbackHistory.length - 1];
      const targetPassage = rollbackTo?.to || p.currentPassage;
      const currentPassage = p.currentPassage;

      const displayedPassages = rollbackHistory
        .map((item) => this.extractDisplayTarget(item.action))
        .filter((item): item is string => Boolean(item));

      const runtimeRes = this.storyRuntimeService.rollback(
        p.dataset ?? '',
        targetPassage,
        (rollbackTo?.variables || p.variables || {}) as Record<string, unknown>,
        displayedPassages,
      );

      const prevTrace: IPlayTrace[] =
        p.trace && p.trace.length > 0
          ? p.trace
          : (prevHistory || []).map((h) => ({
              from: h.from,
              to: h.to,
              action: h.action,
              at: h.at,
              type:
                h.action === 'start'
                  ? ('start' as const)
                  : ('forward' as const),
            }));

      const backTraceEntry: IPlayTrace = {
        from: currentPassage,
        to: runtimeRes.passage,
        action: 'back',
        at: Date.now(),
        type: 'back',
      };
      const newTrace = [...prevTrace, backTraceEntry];

      const updated = await this.playService.update(p.id, {
        currentPassage: runtimeRes.passage,
        variables: runtimeRes.variables as any,
        history: rollbackHistory,
        trace: newTrace,
        dataset: runtimeRes.dataset,
        html: runtimeRes.html,
        isEnding: false,
      });
      if (!updated) return null;

      return {
        ...updated,
        currentPassage: runtimeRes.passage,
        passage: runtimeRes.passage,
        variables: isAuthorOrAdmin ? updated.variables || {} : {},
        history: updated.history || [],
        trace: updated.trace || newTrace,
        html: runtimeRes.html,
        end: null,
      };
    }

    // If runtime action provided, execute via runtime service
    if (dto.target || dto.action || dto.display) {
      const runtimeRes = this.storyRuntimeService.execute(
        p.dataset ?? '',
        dto.target,
        dto.action,
        dto.display,
      );
      const prevHistory = p.history || [];
      const decodedAction: string = this.storyRuntimeService.decodeInteraction(
        dto.action || '',
      );
      const decodedTarget: string = this.storyRuntimeService.decodeInteraction(
        dto.target || '',
      );
      const decodedDisplay: string = this.storyRuntimeService.decodeInteraction(
        dto.display || '',
      );

      const historyAction = decodedAction?.trim()
        ? decodedAction
        : decodedDisplay?.trim()
          ? `display:${decodedDisplay}`
          : `goto:${decodedTarget}`;

      const entry = {
        from: p.currentPassage,
        to: runtimeRes.passage,
        action: historyAction,
        at: Date.now(),
        variables: runtimeRes.variables as any,
      };
      const newHistory = [...prevHistory, entry];

      const prevTrace: IPlayTrace[] =
        p.trace && p.trace.length > 0
          ? p.trace
          : (prevHistory || []).map((h) => ({
              from: h.from,
              to: h.to,
              action: h.action,
              at: h.at,
              type:
                h.action === 'start'
                  ? ('start' as const)
                  : ('forward' as const),
            }));

      const traceEntry: IPlayTrace = {
        from: p.currentPassage,
        to: runtimeRes.passage,
        action: historyAction,
        at: Date.now(),
        type: 'forward',
      };
      const newTrace = [...prevTrace, traceEntry];

      let isEnding = false;
      let end: { name: string; description: string } | null = null;
      // 检查 render-specials（成就/结局），若有则记录为解锁
      try {
        const specials = (runtimeRes as any).specials;
        if (specials) {
          // achievements / points
          if (Array.isArray(specials.points)) {
            for (const pt of specials.points) {
              try {
                await this.playService.createUnlock({
                  playId: p.id,
                  storyId: id,
                  userId: p.userId,
                  type: 'achievement',
                  name: String(pt.name || ''),
                  description: String(pt.description || ''),
                  meta: { passage: runtimeRes.passage },
                } as any);
              } catch {
                // ignore individual unlock errors
              }
            }
          }
          // ending
          if (specials.ending) {
            isEnding = true;
            end = {
              name: String(specials.ending.name || ''),
              description: String(specials.ending.description || ''),
            };
            try {
              await this.playService.createUnlock({
                playId: p.id,
                storyId: id,
                userId: p.userId,
                type: 'ending',
                name: end.name,
                description: end.description,
                meta: { passage: runtimeRes.passage },
              } as any);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore specials handling errors to avoid failing the update
      }

      const updated = await this.playService.update(p.id, {
        currentPassage: runtimeRes.passage,
        variables: runtimeRes.variables as any,
        history: newHistory,
        trace: newTrace,
        dataset: runtimeRes.dataset,
        html: runtimeRes.html,
        isEnding,
      });
      if (!updated) return null;
      return {
        ...updated,
        currentPassage: runtimeRes.passage,
        passage: runtimeRes.passage,
        variables: isAuthorOrAdmin ? updated.variables || {} : {},
        history: updated.history || [],
        trace: updated.trace || newTrace,
        html: runtimeRes.html,
        end,
      };
    }
    throw new Error('缺少交互目标或动作');
  }

  private extractDisplayTarget(action: string): string | null {
    if (!action?.startsWith('display:')) return null;
    const target = action.slice('display:'.length).trim();
    return target || null;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deletePlay(@Param('id') id: string, @Request() req) {
    const p = await this.playService.findLatestByStoryId(id, req.user?.userId);
    if (!p || p.storyId !== id) return null;
    if (p.userId && p.userId !== req.user.userId)
      throw new Error('无权删除该游玩记录');
    await this.playService.remove(p.id);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset/:id')
  async resetPlay(@Param('id') storyId: string, @Request() req) {
    const p = await this.playService.findLatestByStoryId(
      storyId,
      req.user?.userId,
    );
    if (!p || p.storyId !== storyId) return null;
    if (p.userId && p.userId !== req.user.userId)
      throw new Error('无权重置该游玩记录');
    if (!p.isEnding) {
      await this.playService.remove(p.id);
    }
    return this.createPlay(storyId, req);
  }
}
