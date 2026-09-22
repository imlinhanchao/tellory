import { ValidationPipe, Injectable } from '@nestjs/common';
import type { ValidationPipeOptions, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      ...options,
    });
  }

  override transform(value: any, metadata: ArgumentMetadata) {
    if (metadata?.type === 'query' && value && typeof value === 'object') {
      delete value.t;
      delete value._t;
    }

    return super.transform(value, metadata);
  }
}
