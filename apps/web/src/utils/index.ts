

/**
 * 对象生成url
 * @param baseUrl url
 * @param obj
 * @returns {string}
 */
export function setObj2Url(baseUrl: string, obj?: Record<string, any>): string {
  if (!obj) return baseUrl;

  let parameters = '';
  for (const key in obj) {
    parameters += '&' + key + '=' + encodeURIComponent(obj[key]);
  }

  const id = baseUrl.lastIndexOf('?');
  if (id < 0) return baseUrl + '?' + parameters.slice(1);

  return (
    baseUrl.slice(0, id) +
    '?' +
    baseUrl.slice(id + 1).replace(/\/$/, '') +
    parameters
  );
}

/**
 * url生成对象
 * @param {Object} local window.location对象
 * @returns {Record<string, string>} 解析后的查询参数对象
 */
export function getObjOfUrl(
  local?: Partial<{ search: string; hash: string }>,
): Record<string, string> {
  const { hash = '', search = '' } = local || window.location;

  let qs = search.split('?')[1] || '';
  const _hash = hash.split('?')[1] || '';
  if (_hash) qs += '&' + _hash;

  return (qs && Object.fromEntries(new URLSearchParams(qs))) || {};
}


export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload files to the proxied upload endpoint (`/api/upload`).
 * Uses `fetch` and `FormData` as requested.
 * @param files File[] | FileList
 * @param folder optional folder path on the server
 * @param apiKey optional x-api-key header
 */
import { useAuthStore } from '@/stores/modules/auth';
import { Message } from '@/components/msg';

export interface UploadOptions {
  onProgress?: (percent: number, loaded: number, total: number) => void;
  onProcessing?: () => void;
  onXhr?: (xhr: XMLHttpRequest) => void;
}

export async function uploadFiles(
  files: File[] | FileList,
  folder?: string,
  options?: UploadOptions,
): Promise<any> {
  const auth = useAuthStore();

  const form = new FormData();
  if (folder) form.append('folder', folder);

  const list: File[] = Array.from(files as any);
  for (const f of list) {
    form.append('files', f);
  }

  // ensure api key on profile
  let key = auth.getUser?.uploadKey;
  if (!key) {
    await auth.loadProfile();
    key = auth.getUser?.uploadKey;
  }

  const handleErrorCode = (code: number, msg?: string) => {
    let friendly = msg || '上传失败';
    switch (code) {
      case 40001:
        friendly = '参数缺失或未选择文件，请检查后重试。';
        break;
      case 40002:
        friendly = '文件过大，单个文件需小于 1MB。';
        break;
      case 40101:
        friendly = '缺少或无效的上传 Key，请登录后重试。';
        break;
      case 40102:
        friendly = '上传 Key 已过期，请稍候重试。';
        break;
      case 50001:
        friendly = '远程上传失败，请稍后重试。';
        break;
      case 50002:
        friendly = '服务器数据库异常，请稍后重试。';
        break;
    }
    return friendly;
  };

  const doXhr = (xKey?: string) =>
    new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      try { options?.onXhr?.(xhr); } catch {}
      xhr.open('POST', '/api/upload', true);
      if (xKey) {
        try {
          xhr.setRequestHeader('x-api-key', xKey);
        } catch {}
      }

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const percent = Math.round((ev.loaded / ev.total) * 100);
          try { options?.onProgress?.(percent, ev.loaded, ev.total); } catch {}
        }
      };

      xhr.upload.onloadend = () => {
        try { options?.onProcessing?.(); } catch {}
      };

      xhr.onload = async () => {
        const text = xhr.responseText || '';
        let json: any = null;
        try {
          json = JSON.parse(text || '{}');
        } catch (err) {
          reject(new Error('上传返回非 JSON'));
          return;
        }

        resolve(json);
      };

      xhr.onerror = () => reject(new Error('网络错误，上传失败'));
      xhr.onabort = () => reject(new Error('上传已取消'));

      xhr.send(form);
    });

  // first try
  let json: any = await doXhr(key);
  if (!json) {
    const err = '上传请求无响应';
    Message.error(err);
    throw new Error(err);
  }

  // handle expired key by refreshing profile and retrying once
  if (json.code === 40102) {
    Message.error(handleErrorCode(json.code, json.message));
    await auth.loadProfile();
    const newKey = auth.getUser?.uploadKey;
    if (newKey && newKey !== key) {
      json = await doXhr(newKey);
    }
  }

  if (!json || json.code !== 0) {
    const code = json?.code;
    const friendly = code ? handleErrorCode(code, json?.message) : '上传失败';
    Message.error(friendly);
    throw new Error(friendly);
  }

  return json.data;
}