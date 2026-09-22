import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CommentPositionDto {
  @IsString()
  sceneName: string;

  @IsOptional()
  @IsNumber()
  start?: number;

  @IsOptional()
  @IsNumber()
  end?: number;

  @IsOptional()
  @IsNumber()
  startOffset?: number;

  @IsOptional()
  @IsNumber()
  endOffset?: number;

  @IsOptional()
  @IsObject()
  variableSnapshot?: Record<string, any>;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsString()
  selectedText?: string;

  @IsOptional()
  @IsString()
  passageName?: string;
}

export class CreateCommentDto {
  @IsString()
  storyId: string;

  @IsString()
  @MinLength(1, { message: '评论内容不能为空' })
  content: string;

  @IsOptional()
  @IsBoolean()
  isSpoiler?: boolean;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsString()
  replyToUserId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommentPositionDto)
  position?: CommentPositionDto;
}

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '评论内容不能为空' })
  content?: string;

  @IsOptional()
  @IsBoolean()
  isSpoiler?: boolean;
}

export class QueryCommentsDto {
  @IsString()
  storyId: string;

  @IsOptional()
  @IsString()
  sceneName?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  hasPosition?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  tree?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  includeSpoilers?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  createdAt?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  includeBlocked?: boolean;

  @IsOptional()
  t?: any;

  @IsOptional()
  _t?: any;
}

export class BlockCommentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReportCommentDto {
  @IsString()
  @MinLength(1, { message: '举报原因不能为空' })
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ResolveReportDto {
  @IsString()
  action: 'block' | 'dismiss';

  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryReportsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  storyId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  t?: any;

  @IsOptional()
  _t?: any;
}
