import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './comment.entity';
import { CommentReport } from './comment-report.entity';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { UsersModule } from '../users/users.module';
import { StoriesModule } from '../stories/stories.module';
import { PlayModule } from '../play/play.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, CommentReport]),
    UsersModule,
    StoriesModule,
    PlayModule,
  ],
  providers: [CommentService],
  controllers: [CommentController],
  exports: [CommentService],
})
export class CommentModule {}
