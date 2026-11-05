import { Response } from 'express';

interface SuccessResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
}

export interface PaginatedData<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(res: Response, data: T, message = 'Success', statusCode = 200): void {
  const body: SuccessResponse<T> = { statusCode, message, data };
  res.status(statusCode).json(body);
}

export function sendError(res: Response, statusCode: number, code: string, message: string, requestId?: string): void {
  const body: ErrorResponse = { statusCode, code, message, requestId };
  res.status(statusCode).json(body);
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): PaginatedData<T> {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
