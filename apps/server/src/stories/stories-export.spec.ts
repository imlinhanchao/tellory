import { StoriesService } from './stories.service';
import { ExportStoryDto } from './stories.dto';

describe('Stories exportStandalone', () => {
  let storiesService: StoriesService;
  let mockStoriesRepo: any;

  beforeEach(() => {
    mockStoriesRepo = {
      findOne: jest.fn(),
    };
    storiesService = new StoriesService(
      mockStoriesRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('exports standalone HTML from story object', async () => {
    const dto: ExportStoryDto = {
      story: {
        title: '测试故事',
        startPassage: 'Start',
        passages: [
          {
            name: 'Start',
            tags: [],
            content: 'Hello, [[Next]]',
          },
          {
            name: 'Next',
            tags: [],
            content: 'World!',
          },
        ],
      },
      variables: { score: 10 },
      currentPassage: 'Start',
    };

    const res = await storiesService.exportStandalone(dto);
    expect(res).toBeDefined();
    expect(res.html).toContain('<!DOCTYPE html>');
    expect(res.html).toContain('测试故事');
    expect(res.html).toContain('Hello,');
  });

  it('exports standalone HTML from content string', async () => {
    const dto: ExportStoryDto = {
      content: 'title: 文本故事\n\n:: Start\n一段话。',
    };

    const res = await storiesService.exportStandalone(dto);
    expect(res).toBeDefined();
    expect(res.html).toContain('<!DOCTYPE html>');
    expect(res.html).toContain('文本故事');
    expect(res.html).toContain('一段话。');
  });

  it('throws BadRequestException if missing story data', async () => {
    await expect(storiesService.exportStandalone({})).rejects.toThrow(
      '缺少故事内容或ID',
    );
  });
});
