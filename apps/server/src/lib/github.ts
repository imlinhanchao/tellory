import { ConfigService } from '../config/config.service';

export function verify(query: any, domain: string) {
  const verifyReq = {
    client_id: ConfigService.get('github')?.clientId,
    client_secret: ConfigService.get('github')?.clientSecret,
    code: query['code'],
    redirect_uri: `https://${domain}/#/login/github`,
  };
  return fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(verifyReq),
  })
    .then((res) => res.json())
    .then((data) => {
      return data.access_token as string;
    });
}

export interface IGitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
}

export interface IUser {
  id: string;
  name: string;
  login: string;
  avatar_url: string;
  email?: string;
}

export async function getUserEmails(
  access_token: string,
): Promise<IGitHubEmail[]> {
  try {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Tellory',
      },
    });
    const data = await res.json();
    return (Array.isArray(data) ? data : []) as IGitHubEmail[];
  } catch (err) {
    console.error('获取 GitHub 邮箱列表失败:', err);
    return [];
  }
}

export async function getUserInfo(access_token: string): Promise<IUser | null> {
  try {
    const [userRes, emails] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Tellory',
        },
      }).then((res) => res.json()),
      getUserEmails(access_token),
    ]);

    if (!userRes || userRes.message) {
      return null;
    }

    const primary = emails.find((e) => e.primary && e.verified);
    const verified = emails.find((e) => e.verified);
    const email =
      primary?.email ||
      verified?.email ||
      emails[0]?.email ||
      userRes.email ||
      undefined;

    return {
      id: String(userRes.id),
      name: userRes.name,
      login: userRes.login,
      avatar_url: userRes.avatar_url,
      email,
    };
  } catch (err) {
    console.error('获取 GitHub 用户信息失败:', err);
    return null;
  }
}

export function getAuthUrl(domain: string) {
  const clientId = ConfigService.get('github')?.clientId;
  const redirectUri = `https://${domain}/#/login/github`;
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
}
