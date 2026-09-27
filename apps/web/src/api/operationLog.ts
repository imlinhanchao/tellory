import request from "@/utils/http";

export interface IOperationLogItem {
  id: string;
  method: string;
  path: string;
  userId?: string | null;
  headers: Record<string, any>;
  body?: any;
  statusCode?: number | null;
  durationMs?: number | null;
  error?: string | null;
  createdAt: number;
}

export interface IOperationLogQuery {
  page?: number;
  limit?: number;
  method?: string;
  path?: string;
  userId?: string;
}

export interface IOperationLogListResponse {
  data: IOperationLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function adminListOperationLogs(params: IOperationLogQuery = {}) {
  return request.get<IOperationLogListResponse>({
    url: "/operation-logs/admin/list",
    params,
  });
}

export function adminGetOperationLogDetail(id: string) {
  return request.get<IOperationLogItem>({
    url: `/operation-logs/admin/${id}`,
  });
}
