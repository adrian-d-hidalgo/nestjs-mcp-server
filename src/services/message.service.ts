import { Injectable } from '@nestjs/common';

import { AsyncLocalStorage } from 'async_hooks';

import { McpMessage } from '../interfaces/message.types';

export const requestContext = new AsyncLocalStorage<McpMessage>();

@Injectable()
export class MessageService {
  public set(context: McpMessage): void {
    requestContext.enterWith(context);
  }

  public get(): McpMessage | undefined {
    return requestContext.getStore();
  }
}
