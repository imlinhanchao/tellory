import {
  Controller,
  Get,
  Post,
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
import { StoriesService, StorySort } from './stories.service';
import { StoryDto, RejectDto, ExportStoryDto } from './stories.dto';
import { StoryRuntimeService } from './story-runtime.service';
import { getDomain } from 'src/utils';

@Controller('stories')
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly storyRuntimeService: StoryRuntimeService,
  ) {}

  @UseGuards(OptionalAuthGuard)
  @Get()
  async list(
    @Request() req,
    @Query('createdAt') createdAt?: number,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('sort') sort?: string,
    @Query('authorId') authorId?: string,
    @Query('search') search?: string,
    @Query('private') isPrivate?: string | number,
  ) {
    const c = createdAt || Date.now();
    const l = limit || 20;
    // 未传 authorId（如首页浏览），或 authorId 与已认证用户不一致时，均视为公开请求（不返回草稿）
    let isPublicRequest = !authorId || authorId !== req?.user?.userId;
    if (req?.user?.isAdmin && Number(isPrivate) === 1) {
      isPublicRequest = false;
    }
    const sortType: StorySort =
      sort === 'hot' || sort === 'liked' ? sort : 'latest';
    return this.storiesService.findAll(
      c,
      l,
      authorId,
      search,
      isPublicRequest,
      req?.user?.isAdmin,
      sortType,
      page,
      req?.user?.userId,
    );
  }

  // 用户喜爱的作品列表（公开，须在 :id 之前声明以避免路由被拦截）
  @Get('liked')
  async likedStories(@Query('userId') userId: string) {
    if (!userId) {
      throw new Error('缺少 userId');
    }
    return this.storiesService.getUserLikedStories(userId);
  }

  // 我参与内测的故事列表（需在 :id 之前声明以避免路由被拦截）
  @Get('beta')
  @UseGuards(JwtAuthGuard)
  async myBetaStories(@Request() req) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error('缺少用户ID');
    }
    return this.storiesService.getUserBetaStories(userId);
  }

  // 作者/管理员：查看某历史版本详情（含 content，用于内容查看与比对）
  @Get('history/:historyId')
  @UseGuards(JwtAuthGuard)
  async historyDetailById(
    @Param('historyId') historyId: string,
    @Request() req: any,
  ) {
    const history = await this.storiesService.findStoryHistoryById(historyId);
    if (!history) {
      throw new Error('历史版本不存在');
    }
    const story = await this.storiesService.findOne(history.storyId);
    if (!story || (story.authorId !== req.user.userId && !req.user.isAdmin)) {
      throw new Error('无权操作');
    }
    return history;
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  async get(@Param('id') id: string, @Request() req) {
    const story = await this.storiesService.findOne(id);
    if (!story) {
      throw new Error('故事不存在');
    }
    // 未发布的故事仅作者、管理员与内测用户可访问（内测用户通过试玩链接访问）
    if (
      story.status === 'draft' &&
      story.authorId !== req?.user?.userId &&
      !req?.user?.isAdmin &&
      !(await this.storiesService.isBetaTester(story.id, req?.user?.userId))
    ) {
      throw new Error('故事尚未发布');
    }
    return story;
  }

  @UseGuards(OptionalAuthGuard)
  @Post('export')
  async exportStory(@Body() dto: ExportStoryDto, @Request() req) {
    return this.storiesService.exportStandalone(
      dto,
      req?.user?.userId,
      req?.user?.isAdmin,
    );
  }

  @UseGuards(OptionalAuthGuard)
  @Post(':id/export')
  async exportStoryById(
    @Param('id') id: string,
    @Body() dto: ExportStoryDto,
    @Request() req,
  ) {
    return this.storiesService.exportStandalone(
      { ...dto, id },
      req?.user?.userId,
      req?.user?.isAdmin,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: StoryDto, @Request() req) {
    dto.authorId = req.user.userId;
    return this.storiesService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<StoryDto>,
    @Request() req,
  ) {
    const story = await this.storiesService.findOne(id);
    if (!story || story.authorId !== req.user.userId) {
      throw new Error('无权操作');
    }
    return this.storiesService.update(id, dto);
  }

  /** 作者/管理员：查看故事的内测用户列表 */
  @UseGuards(JwtAuthGuard)
  @Get(':id/beta-testers')
  async betaTesters(@Param('id') id: string, @Request() req) {
    const story = await this.storiesService.findOne(id);
    if (!story || (story.authorId !== req.user.userId && !req.user.isAdmin)) {
      throw new Error('无权操作');
    }
    return this.storiesService.getBetaTesters(story.id);
  }

  /** 作者：添加内测用户（传 userId） */
  @UseGuards(JwtAuthGuard)
  @Post(':id/beta-testers')
  async addBetaTester(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Request() req,
  ) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('缺少用户ID');
    }
    const story = await this.storiesService.findOne(id);
    if (!story || story.authorId !== req.user.userId) {
      throw new Error('无权操作');
    }
    await this.storiesService.addBetaTester(story.id, userId, getDomain(req));
    return { success: true };
  }

  /** 作者：移除内测用户 */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/beta-testers/:userId')
  async removeBetaTester(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    const story = await this.storiesService.findOne(id);
    if (!story || story.authorId !== req.user.userId) {
      throw new Error('无权操作');
    }
    await this.storiesService.removeBetaTester(story.id, userId);
    return { success: true };
  }

  /** 作者/管理员：分页查询某故事的历史版本列表 */
  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  async storyHistoryList(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    const story = await this.storiesService.findOne(id);
    if (!story) {
      throw new Error('故事不存在');
    }
    if (story.authorId !== req.user.userId && !req.user.isAdmin) {
      throw new Error('无权操作');
    }
    return this.storiesService.listStoryHistory(id, page, limit);
  }

  /** 作者/管理员：查看某历史版本详情（含 content，用于内容查看与比对） */
  @UseGuards(JwtAuthGuard)
  @Get(':id/history/:historyId')
  async storyHistoryDetail(
    @Param('id') id: string,
    @Param('historyId') historyId: string,
    @Request() req: any,
  ) {
    const story = await this.storiesService.findOne(id);
    if (!story) {
      throw new Error('故事不存在');
    }
    if (story.authorId !== req.user.userId && !req.user.isAdmin) {
      throw new Error('无权操作');
    }
    const history = await this.storiesService.findStoryHistoryById(historyId);
    if (!history || history.storyId !== id) {
      throw new Error('历史版本不存在');
    }
    return history;
  }

  /** 作者/管理员：获取某故事当前已发布快照（用于对比当前版本与已发布版本内容差异） */
  @UseGuards(JwtAuthGuard)
  @Get(':id/approved')
  async storyApprovedSnapshot(@Param('id') id: string, @Request() req: any) {
    const story = await this.storiesService.findOne(id);
    if (!story) {
      throw new Error('故事不存在');
    }
    if (story.authorId !== req.user.userId && !req.user.isAdmin) {
      throw new Error('无权操作');
    }
    return this.storiesService.findApprovedBySourceId(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const story = await this.storiesService.findOne(id);
    if (!story || story.authorId !== req.user.userId) {
      throw new Error('这不是你的故事');
    }
    // 不允许删除曾经上架过的故事（存在已上架快照）
    const approved = await this.storiesService.getApprovedByIds([id]);
    if (approved && approved.length > 0) {
      throw new Error('已发布的故事不能删除');
    }
    return this.storiesService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/publish')
  async publish(@Param('id') id: string, @Request() req) {
    const domain = getDomain(req);
    return this.storiesService.publish(id, req.user.userId, domain);
  }

  // 喜爱故事（不可撤回，重复请求幂等）
  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async like(@Param('id') id: string, @Request() req) {
    return this.storiesService.likeStory(id, req.user.userId);
  }

  // 管理员：列出待审核的故事（未发布）
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/pending')
  async pending(@Query('limit') limit?: number) {
    const res = await this.storiesService.findAll(
      Date.now(),
      limit || 50,
      undefined,
      undefined,
      false,
    );
    // filter pending submissions
    const pending = res.data.filter((s) => s.status === 'pending');
    return { data: pending, total: pending.length };
  }

  // 管理员：查看某历史版本详情（含 content，用于内容查看与比对）
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/history/:historyId')
  async historyDetail(@Param('historyId') historyId: string) {
    const history = await this.storiesService.findStoryHistoryById(historyId);
    if (!history) {
      throw new Error('历史版本不存在');
    }
    return history;
  }

  // 管理员：分页查询某故事的历史版本列表
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/:id/history')
  async historyList(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.storiesService.listStoryHistory(id, page, limit);
  }

  // 管理员：获取某故事当前已发布快照（用于审核时对比提审版本内容差异）
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/:id/approved')
  async approvedSnapshot(@Param('id') id: string) {
    return this.storiesService.findApprovedBySourceId(id);
  }

  // 管理员审核通过并上架
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/approve')
  async approve(@Param('id') id: string, @Request() req) {
    const adminId = req.user.userId;
    const domain = getDomain(req);
    return this.storiesService.approve(id, adminId, domain);
  }

  // 管理员拒绝投稿
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: RejectDto,
    @Request() req,
  ) {
    const adminId = req.user.userId;
    const domain = getDomain(req);
    return this.storiesService.reject(id, adminId, body?.reason, domain);
  }

  // 管理员下架已审核并上架的故事
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/unpublish')
  async unpublish(@Param('id') id: string, @Request() req) {
    const adminId = req.user.userId;
    return this.storiesService.unpublish(id, adminId);
  }

  // 管理员重新上架已下架的故事
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/republish')
  async republish(@Param('id') id: string, @Request() req) {
    const adminId = req.user.userId;
    return this.storiesService.republish(id, adminId);
  }
}
