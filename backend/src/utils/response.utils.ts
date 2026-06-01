import { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function fail(res: Response, message: string, status = 400): Response {
  return res.status(status).json({ success: false, message });
}