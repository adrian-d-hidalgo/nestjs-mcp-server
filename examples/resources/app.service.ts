import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import {
  ReadResourceResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types';
import { Injectable } from '@nestjs/common';

import { Resource } from '../../src';

const USER_LIST = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
  },
];

@Injectable()
export class AppService {
  /**
   * Simple resource with only a name
   * Use case: Basic resource without metadata or template
   */
  @Resource({
    name: 'get_users',
    uri: 'users://list',
  })
  getSimpleDocument(
    uri: URL,
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ): ReadResourceResult {
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(USER_LIST),
        },
      ],
    };
  }

  /**
   * Resource with URI and metadata
   * Use case: When you need to add contextual information about the resource
   */
  @Resource({
    name: 'get_users_with_filters',
    uri: 'users://list/metadata',
    metadata: {},
  })
  getUserProfile(uri: URL): ReadResourceResult {
    const users = USER_LIST.map((user) => ({ id: user.id, name: user.name }));

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(users),
        },
      ],
    };
  }

  /**
   * Resource with template
   * Use case: When you need dynamic parameters in the resource URI
   */
  @Resource({
    name: 'greet',
    template: 'geet://{name}',
  })
  getUserById(
    uri: URL,
    variables: {
      name: string;
    },
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ): ReadResourceResult {
    return {
      contents: [
        {
          uri: uri.href,
          text: `Hello, ${variables.name}!`,
        },
      ],
    };
  }

  /**
   * Resource with template
   * Use case: When you need dynamic parameters in the resource URI
   */
  @Resource({
    name: 'get_user_by_id',
    template: 'users://{userId}',
    metadata: {
      version: 1,
    },
  })
  getUserByIdWithMetada(
    uri: URL,
    variables: {
      userId: string;
    },
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ): ReadResourceResult {
    const user = USER_LIST.find((user) => user.id === variables.userId);

    return {
      contents: [
        {
          uri: uri.href,
          text: user ? JSON.stringify(user) : 'User not found',
        },
      ],
    };
  }
}
