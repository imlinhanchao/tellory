import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
} from 'class-validator';

export class StoryDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'pending' | 'published' | 'rejected';

  @IsOptional()
  @IsString()
  startPassage?: string;

  @IsOptional()
  @IsString()
  shortname?: string;

  @IsOptional()
  @IsNumber()
  passageSize?: number;

  @IsOptional()
  @IsNumber()
  pointSize?: number;

  @IsOptional()
  @IsNumber()
  endSize?: number;
}

export class RejectDto {
  @IsString()
  reason?: string;
}

export class ExportStoryDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsObject()
  story?: any;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  currentPassage?: string;
}
