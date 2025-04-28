import {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types';

import { Prompt, Resolver, Resource, Tool } from '../../src';

@Resolver('mixed')
export class MixedResolver {
  @Resource({
    name: 'country_list',
    uri: 'contry://list',
  })
  getCountryList(uri: URL): ReadResourceResult {
    return {
      contents: [
        {
          uri: uri.href,
          text: 'Mexico, USA, Canada',
        },
      ],
    };
  }

  @Tool({
    name: 'get_country_info',
  })
  getCountryInfo(): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: 'The capital of France is Paris.',
        },
      ],
    };
  }

  @Prompt({
    name: 'get_country_info',
  })
  getCountryInfoPrompt(): GetPromptResult {
    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: 'What is the capital of France?',
          },
        },
      ],
    };
  }
}
