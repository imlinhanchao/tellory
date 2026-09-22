import { AppValidationPipe } from './validation.pipe';
import { IsString } from 'class-validator';

class SampleQueryDto {
  @IsString()
  name: string;
}

describe('AppValidationPipe', () => {
  let pipe: AppValidationPipe;

  beforeEach(() => {
    pipe = new AppValidationPipe();
  });

  it('should strip t and _t from query and validate successfully', async () => {
    const input = {
      name: 'hello',
      t: '1790047160890',
      _t: '123456789',
    };

    const result = await pipe.transform(input, {
      type: 'query',
      metatype: SampleQueryDto,
    });

    expect(result).toBeInstanceOf(SampleQueryDto);
    expect(result.name).toBe('hello');
    const record = result as Record<string, unknown>;
    expect(record.t).toBeUndefined();
    expect(record._t).toBeUndefined();
  });

  it('should still forbid other non-whitelisted properties in query', async () => {
    const input = {
      name: 'hello',
      unknownProp: 'bad',
    };

    await expect(
      pipe.transform(input, {
        type: 'query',
        metatype: SampleQueryDto,
      }),
    ).rejects.toThrow();
  });
});
