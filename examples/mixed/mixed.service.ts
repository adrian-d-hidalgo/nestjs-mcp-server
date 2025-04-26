import { McpCapabilityProvider, Resource, Tool, Prompt } from '../../src';
import {
  ReadResourceResult,
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types';

@McpCapabilityProvider()
export class MixedService {
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
      content: [],
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
