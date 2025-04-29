import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
// import * as request from 'supertest';

import { App } from 'supertest/types';

import { AppModule } from '../examples/tools/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    console.log('Starting test suite...');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    await app
      .init()
      .then(() => {
        console.log('App initialized');
      })
      .catch((error) => {
        console.error('Error initializing app:', error);
        throw error;
      });
  });

  it('should stremeable client works', async () => {
    let client: Client | undefined = undefined;

    const baseUrl = new URL('http://localhost:3000');

    try {
      client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);
      console.log('Connected using Streamable HTTP transport');
      await transport.close();
    } catch (error) {
      console.log('Error connecting using Streamable HTTP transport');
      console.log(error);
      throw error;
    }
  });

  it('should sse client works', async () => {
    let client: Client | undefined = undefined;

    const baseUrl = new URL('http://localhost:3000');

    try {
      client = new Client({
        name: 'sse-client',
        version: '1.0.0',
      });
      const sseTransport = new SSEClientTransport(baseUrl);
      await client.connect(sseTransport);
      console.log('Connected using SSE transport');
    } catch (error) {
      console.log('Error connecting using SSE transport');
      console.log(error);
      throw error;
    }
  });
});
