import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { getConfig } from './utils/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // 全局过滤防缓存时间戳参数 (t / _t)，避免污染接口并触发 forbidNonWhitelisted 校验错误
  app.use((req: any, _res: any, next: any) => {
    if (req.query) {
      delete req.query.t;
      delete req.query._t;
    }
    next();
  });

  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Server API')
    .setDescription('NestJS backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  app.enableCors();
  await app.listen(getConfig()?.port ?? process.env.PORT ?? 3000);
}
void bootstrap();
