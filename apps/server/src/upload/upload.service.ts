import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ConfigService } from '../config/config.service';

export interface IUploadFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadedFileItem {
  originalName: string;
  storedName: string;
  url: string;
  id?: number;
}

export interface UploadResult {
  succMap: Record<string, string>;
  errFiles: string[];
  files: UploadedFileItem[];
}

function getExtensionFromMime(mime: string): string {
  const cleanMime = (mime || '').split(';')[0].trim().toLowerCase();
  switch (cleanMime) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    case 'image/bmp':
      return 'bmp';
    case 'image/avif':
      return 'avif';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'ico';
    default:
      return '';
  }
}

function getExtension(name: string, mime: string): string {
  const cleanName = (name || '').trim();
  const lastDot = cleanName.lastIndexOf('.');
  if (lastDot > 0 && lastDot < cleanName.length - 1) {
    const ext = cleanName.substring(lastDot + 1).toLowerCase();
    // 扩展名必须是 1~16 位字母数字
    if (/^[a-zA-Z0-9]{1,16}$/.test(ext)) {
      return ext;
    }
  }

  return getExtensionFromMime(mime) || 'png';
}

function generateHashTimestampFilename(file: IUploadFile): string {
  const hash = createHash('md5').update(file.buffer).digest('hex');
  const timestamp = Date.now();
  const ext = getExtension(file.originalname, file.mimetype);
  return `${hash}.${timestamp}.${ext}`;
}

@Injectable()
export class UploadService {
  /**
   * 上传文件到图床（调用 pic.md 规范的 API 接口）
   */
  async uploadFiles(files: IUploadFile[]): Promise<UploadResult> {
    const uploadKey = ConfigService.get('uploadKey');
    if (!uploadKey || typeof uploadKey !== 'string' || !uploadKey.trim()) {
      throw new BadRequestException('系统未配置 uploadKey，无法使用图床上传');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const rawBaseUrl =
      (ConfigService.get('uploadUrl') as string) || 'https://pic.fishpi.cn';
    const baseUrl = rawBaseUrl.replace(/\/$/, '');

    const succMap: Record<string, string> = {};
    const errFiles: string[] = [];
    const fileResults: UploadedFileItem[] = [];
    const errorDetails: string[] = [];

    // pic.md 规定使用 API Key 时为单文件语义，多个文件并行单文件调用
    await Promise.all(
      files.map(async (file) => {
        try {
          const item = await this.uploadSingleFile(
            file,
            uploadKey.trim(),
            baseUrl,
          );
          succMap[file.originalname] = item.url;
          fileResults.push(item);
        } catch (err: any) {
          errFiles.push(file.originalname);
          errorDetails.push(`${file.originalname}: ${err?.message || err}`);
        }
      }),
    );

    if (fileResults.length === 0) {
      const msg =
        errorDetails.length > 0 ? errorDetails.join('; ') : '图片上传失败';
      throw new BadRequestException(msg);
    }

    return {
      succMap,
      errFiles,
      files: fileResults,
    };
  }

  /**
   * 单文件上传至 pic 接口
   */
  private async uploadSingleFile(
    file: IUploadFile,
    uploadKey: string,
    baseUrl: string,
  ): Promise<UploadedFileItem> {
    const form = new FormData();
    const blob = new Blob([file.buffer as any], {
      type: file.mimetype || 'application/octet-stream',
    });
    // 文件名格式：hash.timestamp.ext
    const safeFilename = generateHashTimestampFilename(file);
    form.append('file', blob, safeFilename);

    const targetUrl = `${baseUrl}/api/v1/files`;
    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${uploadKey}`,
          'User-Agent':
            'Mozilla/5.0 (compatible; Tellory/1.0; +https://tellory.fun)',
        },
        body: form,
      });
    } catch (err: any) {
      throw new Error(`网络请求失败: ${err?.message || err}`);
    }

    let json: any = null;
    try {
      json = await response.json();
    } catch {
      throw new Error(`图床返回非 JSON 数据 (HTTP ${response.status})`);
    }

    if (!response.ok || !json?.data?.file?.public_url) {
      const errMsg =
        json?.error?.message ||
        json?.error?.code ||
        json?.message ||
        `图床上传失败 (HTTP ${response.status})`;
      throw new Error(errMsg);
    }

    const fileMeta = json.data.file;
    return {
      originalName: file.originalname,
      storedName: fileMeta.object_key || fileMeta.original_name || safeFilename,
      url: fileMeta.public_url,
      id: fileMeta.id,
    };
  }
}
