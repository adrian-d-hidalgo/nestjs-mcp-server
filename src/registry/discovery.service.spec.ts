import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import {
  MCP_PROMPT,
  MCP_RESOURCE,
  MCP_TOOL,
} from '../decorators/capabilities.constants';
import { DiscoveryService } from './discovery.service';

describe('DiscoveryService', () => {
  let service: DiscoveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [DiscoveryService],
    }).compile();
    service = module.get(DiscoveryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty array for MCP_RESOURCE metadata', () => {
    const methods = service.getAllMethodsWithMetadata(MCP_RESOURCE);
    expect(methods).toBeDefined();
    expect(methods.length).toBe(0);
  });

  it('should return empty array for MCP_PROMPT metadata', () => {
    const methods = service.getAllMethodsWithMetadata(MCP_PROMPT);
    expect(methods).toBeDefined();
    expect(methods.length).toBe(0);
  });

  it('should return empty array for MCP_TOOL metadata', () => {
    const methods = service.getAllMethodsWithMetadata(MCP_TOOL);
    expect(methods).toBeDefined();
    expect(methods.length).toBe(0);
  });
});
