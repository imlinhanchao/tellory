import path from 'path';
import fs from 'fs';
import { ConfigService } from 'src/config/config.service';

export const configPath = path.resolve(__dirname, '../../config.json');

export function hasConfigFile() {
  return fs.existsSync(configPath);
}

export function omit(obj: Record<string, any>, keys: string[]) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * 从请求对象中提取域名 (Origin / Host)
 * @param req 请求对象
 * @param hostOnly 是否仅返回 host (例如用于拼接 https:// 的场景)
 */
export function getDomain(req: any, hostOnly = false): string {
  const url = new URL(
    req.headers.referer || `${req.protocol}://${req.headers.host}`,
  );
  return hostOnly ? url.host : url.origin;
}

export function getHost(req: any): string {
  return getDomain(req, true);
}

export const getOrigin = getDomain;

/**
 * 请求 upload 服务生成上传用的短期 API Key
 * 返回 key 字符串或 null
 */
export async function getUploadKeyForUser(
  username: string,
): Promise<string | null> {
  const upload = ConfigService.get('upload');
  if (!upload) return null;

  const from = 'tellory';
  try {
    const base = String(upload).replace(/\/$/, '');
    const res = await fetch(`${base}/api/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, from }),
    });
    const body = await res.text();
    const json = JSON.parse(body);
    if (json && json.code === 0 && json.data && json.data.key) {
      return String(json.data.key);
    }
  } catch (err) {
    // ignore and return null on failure
    console.error(err);
  }
  return null;
}
