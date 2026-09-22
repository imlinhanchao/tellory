import { IsOptional, IsBoolean, IsNumber, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { NotificationType } from './notification.entity';

export class QueryNotificationsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1')
      return true;
    if (value === 'false' || value === false || value === 0 || value === '0')
      return false;
    return undefined;
  })
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

export interface NotificationSenderInfo {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

export interface NotificationWithSender {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  senderId?: string;
  storyId?: string;
  commentId?: string;
  extra?: Record<string, any>;
  isRead: boolean;
  createdAt: number;
  updatedAt: number;
  sender?: NotificationSenderInfo;
}
