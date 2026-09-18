import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { BaseStoryFields } from '../stories/base-story.entity';

export class UpdatePlayDto {
  @IsOptional()
  @IsBoolean()
  back?: boolean;

  @IsOptional()
  @IsString()
  target?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  display?: string;
}

export class PlayStoryDto extends BaseStoryFields {
  storyId: string;
  points: { name: string; description: string }[];
  end: { name: string; description: string }[];
  status: string;
  isPlaying: boolean;
}
