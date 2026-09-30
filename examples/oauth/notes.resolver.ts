import { Type } from '@nestjs/common';
import { z } from 'zod';

import {
  CallToolResult,
  getAuthInfo,
  McpContext,
  Resolver,
  Tool,
  UseGuards,
} from '../../src';
import { ForceUnauthorizedGuard } from './force-unauthorized.guard';
import { OAuthExampleConfig } from './oauth.config';

const notes: string[] = ['Welcome to the OAuth example'];

/**
 * Builds the notes resolver for `config`.
 *
 * A factory rather than a plain class only for the `OAUTH_FORCE_AUTHORIZED`
 * demo: a tool's `scopes` is fixed when its decorator runs, so a tool listed
 * there is declared with no `scopes` — any authenticated caller may call it.
 * The list is therefore read once, at boot. A real server declares its
 * scopes statically on a `@Resolver` class.
 */
export const createNotesResolver = (
  config: Pick<OAuthExampleConfig, 'forceAuthorized'>,
): Type<unknown> => {
  /** `{ scopes }`, unless the tool is forced open. */
  const requires = (
    tool: string,
    scopes: [string, ...string[]],
  ): { scopes?: [string, ...string[]] } =>
    config.forceAuthorized.includes(tool) ? {} : { scopes };

  @Resolver('notes')
  @UseGuards(ForceUnauthorizedGuard)
  class NotesResolver {
    @Tool({
      name: 'whoami',
      description: 'Returns the OAuth client and user the token was issued to',
    })
    whoami(ctx: McpContext): CallToolResult {
      // `sub` is what `JwksJwtStrategy` puts in `extra`.
      const auth = getAuthInfo<{ sub?: string }>(ctx);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              clientId: auth?.clientId,
              scopes: auth?.scopes,
              sub: auth?.extra?.sub,
            }),
          },
        ],
      };
    }

    @Tool({
      name: 'list_notes',
      description: 'Lists notes (requires notes:read)',
      ...requires('list_notes', ['notes:read']),
    })
    listNotes(): CallToolResult {
      return { content: [{ type: 'text', text: JSON.stringify(notes) }] };
    }

    @Tool({
      name: 'add_note',
      description: 'Adds a note (requires notes:write)',
      paramsSchema: z.object({ text: z.string() }),
      ...requires('add_note', ['notes:write']),
    })
    addNote(params: { text: string }): CallToolResult {
      notes.push(params.text);
      return {
        content: [{ type: 'text', text: `Added note #${notes.length}` }],
      };
    }
  }

  return NotesResolver;
};
