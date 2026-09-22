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
import { CommentService } from './comment.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  QueryCommentsDto,
  BlockCommentDto,
  ReportCommentDto,
  ResolveReportDto,
  QueryReportsDto,
} from './comment.dto';

@Controller(['comments', 'comment'])
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateCommentDto, @Request() req) {
    return this.commentService.create(req.user.userId, dto);
  }

  @UseGuards(OptionalAuthGuard)
  @Get()
  async list(@Query() query: QueryCommentsDto, @Request() req) {
    const isAdmin = Boolean(req?.user?.isAdmin);
    const currentUserId = req?.user?.userId;
    return this.commentService.findAll(query, isAdmin, currentUserId);
  }

  @UseGuards(OptionalAuthGuard)
  @Get('counts')
  async getCounts(@Query('storyId') storyId: string, @Request() req) {
    const isAdmin = Boolean(req?.user?.isAdmin);
    const currentUserId = req?.user?.userId;
    return this.commentService.getSceneCommentCounts(
      storyId,
      currentUserId,
      isAdmin,
    );
  }

  // 管理员获取举报列表（须在 :id 之前声明以避免路由被拦截）
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/reports')
  async listReports(@Query() query: QueryReportsDto) {
    return this.commentService.findReports(query);
  }

  // 管理员处理举报
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/reports/:id/resolve')
  async resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @Request() req,
  ) {
    return this.commentService.resolveReport(id, req.user.userId, dto);
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  async getOne(@Param('id') id: string, @Request() req) {
    const isAdmin = Boolean(req?.user?.isAdmin);
    const currentUserId = req?.user?.userId;
    return this.commentService.findOne(id, isAdmin, currentUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Request() req,
  ) {
    return this.commentService.update(
      id,
      req.user.userId,
      !!req.user.isAdmin,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    return this.commentService.remove(id, req.user.userId, !!req.user.isAdmin);
  }

  // 普通用户举报评论
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async report(
    @Param('id') id: string,
    @Body() dto: ReportCommentDto,
    @Request() req,
  ) {
    return this.commentService.report(id, req.user.userId, dto);
  }

  // 管理员屏蔽评论
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/block')
  async block(
    @Param('id') id: string,
    @Body() dto: BlockCommentDto,
    @Request() req,
  ) {
    return this.commentService.block(id, req.user.userId, dto?.reason);
  }

  // 管理员解除评论屏蔽
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/unblock')
  async unblock(@Param('id') id: string) {
    return this.commentService.unblock(id);
  }
}
