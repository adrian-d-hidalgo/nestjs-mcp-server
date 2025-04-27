import {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types';

import { McpProvider, Prompt, Resource, Tool } from '../../src';

@McpProvider()
export class AppService {
  @Resource({
    name: 'country_list',
    uri: 'resource://countries/list',
  })
  getCountryList(): ReadResourceResult {
    return {
      uri: 'resource://countries/list',
      contents: [],
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
