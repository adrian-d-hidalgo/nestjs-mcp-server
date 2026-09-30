import { z } from 'zod';

import {
  CallToolResult,
  getAuthInfo,
  McpContext,
  Resolver,
  Tool,
} from '../../src';
import type { NotesAuthExtra } from './auth.constants';

const notes: string[] = ['Welcome to the auth example'];

@Resolver('notes')
export class NotesResolver {
  @Tool({
    name: 'whoami',
    description: 'Returns the authenticated caller as the server sees it',
  })
  whoami(ctx: McpContext): CallToolResult {
    const auth = getAuthInfo<NotesAuthExtra>(ctx);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              clientId: auth?.clientId,
              scopes: auth?.scopes,
              extra: auth?.extra,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  @Tool({
    name: 'list_notes',
    description: 'Lists notes (requires notes:read)',
    scopes: ['notes:read'],
  })
  listNotes(): CallToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(notes) }] };
  }

  @Tool({
    name: 'add_note',
    description: 'Adds a note (requires notes:write)',
    paramsSchema: z.object({ text: z.string() }),
    scopes: ['notes:write'],
  })
  addNote(params: { text: string }): CallToolResult {
    notes.push(params.text);
    return { content: [{ type: 'text', text: `Added note #${notes.length}` }] };
  }
}
