import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

export type Request = ExpressRequest & {
  auth?: any;
};

export type McpMessage = {
  req: Request;
  res: ExpressResponse;
};
