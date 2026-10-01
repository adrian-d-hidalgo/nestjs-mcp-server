import { McpProtectedResourceController } from './auth/mcp-protected-resource.controller';
import * as api from './index';

describe('package root', () => {
  it('exports McpProtectedResourceController so applications can decorate it', () => {
    expect(api).toHaveProperty(
      'McpProtectedResourceController',
      McpProtectedResourceController,
    );
  });
});
