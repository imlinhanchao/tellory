import request from "@/utils/http";

export interface ConfigData {
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    entityPrefix: string;
  };
  port: number;
  jwtSecret: string;
  salt: string;
  github: {
    clientId: string;
    clientSecret: string;
  };
  steam: {
    apiKey: string;
    mirror?: string;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  noticeGoldenKey?: string;
  noticeUsers?: string;
}

export interface ConfigStatus {
  configured: boolean;
}

export function getConfigStatus() {
  return request.get<ConfigStatus>({ url: "/config/status" });
}

export function setupConfig(config: ConfigData) {
  return request.post<{ message: string }>({ url: "/config", data: config });
}

export function updateConfig(config: Partial<ConfigData>) {
  return request.put<{ message: string }>({ url: "/config", data: config });
}
