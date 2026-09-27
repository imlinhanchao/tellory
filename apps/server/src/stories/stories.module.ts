import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Story } from './story.entity';
import { ApprovedStory } from './approved-story.entity';
import { StoryHistory } from './story-history.entity';
import { StoryLike } from './story-like.entity';
import { Play } from '../play/play.entity';
import { Comment } from '../comment/comment.entity';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { UsersModule } from 'src/users/users.module';
import { StoryRuntimeService } from './story-runtime.service';
import { NotificationModule } from '../notification/notification.module';
import { StoryBetaTester } from './story-beta-tester.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Story,
      ApprovedStory,
      StoryHistory,
      StoryLike,
      StoryBetaTester,
      Play,
      Comment,
    ]),
    UsersModule,
    NotificationModule,
  ],
  providers: [StoriesService, StoryRuntimeService],
  controllers: [StoriesController],
  exports: [StoriesService, StoryRuntimeService],
})
export class StoriesModule {}
