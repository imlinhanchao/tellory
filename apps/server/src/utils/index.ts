import path from 'path';
import fs from 'fs';

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
