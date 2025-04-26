import { ReadResourceResult } from '@modelcontextprotocol/sdk/types';

import { McpCapabilityProvider, Resource } from '../../src';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

interface Article {
  id: string;
  title: string;
  author: string;
  published: string;
  content: string;
  tags: string[];
  readTime: number;
}

@McpCapabilityProvider()
export class ResourcesService {
  /**
   * Simple resource with only a name
   * Use case: Basic resource without metadata or template
   */
  @Resource({
    name: 'simple_document',
    uri: 'resource://documents/simple',
  })
  getSimpleDocument(): ReadResourceResult {
    return {
      uri: 'resource://documents/simple',
      contents: [
        {
          uri: 'resource://documents/simple',
          text: 'This is a simple document resource with no metadata.',
        },
      ],
    };
  }

  /**
   * Resource with URI and metadata
   * Use case: When you need to add contextual information about the resource
   */
  @Resource({
    name: 'user_profile',
    uri: 'resource://users/profile',
    metadata: {
      description: 'User profile information with personal details',
      version: '1.0',
      tags: ['user', 'profile', 'personal'],
    },
  })
  getUserProfile(): ReadResourceResult {
    return {
      uri: 'resource://users/profile',
      contents: [
        {
          uri: 'resource://users/profile',
          text: 'This is a user profile resource with no metadata.',
        },
      ],
    };
  }

  /**
   * Resource with template
   * Use case: When you need dynamic parameters in the resource URI
   */
  @Resource({
    name: 'product_details',
    template: 'resource://catalog/products/{productId}',
  })
  getProductDetails(params: { productId: string }): ReadResourceResult {
    // Mock product lookup based on the dynamic productId parameter
    const products: Record<string, Product> = {
      p001: {
        id: 'p001',
        name: 'Smartphone X',
        price: 899.99,
        category: 'Electronics',
        inStock: true,
      },
      p002: {
        id: 'p002',
        name: 'Wireless Headphones',
        price: 149.99,
        category: 'Audio',
        inStock: false,
      },
    };

    const product = products[params.productId] || {
      id: params.productId,
      name: 'Unknown Product',
      price: 0,
      category: 'N/A',
      inStock: false,
    };

    return {
      uri: `resource://catalog/products/${params.productId}`,
      contents: [
        {
          uri: `resource://catalog/products/${params.productId}`,
          text: JSON.stringify(product),
        },
      ],
    };
  }

  /**
   * Comprehensive resource with template and metadata
   * Use case: Complex resource needing both dynamic URI and descriptive metadata
   */
  @Resource({
    name: 'article_content',
    template: 'resource://blog/articles/{articleId}/content',
    metadata: {
      description: 'Retrieves the full content of a blog article',
      version: '2.1',
      tags: ['blog', 'article', 'content'],
      permissions: ['read:articles'],
      cacheControl: 'max-age=3600',
    },
  })
  getArticleContent(params: { articleId: string }): ReadResourceResult {
    // Mock article content based on the dynamic articleId parameter
    const articles: Record<string, Article> = {
      a001: {
        id: 'a001',
        title: 'Getting Started with NestJS',
        author: 'Jane Smith',
        published: '2023-08-15T09:30:00Z',
        content:
          'NestJS is a progressive Node.js framework for building efficient and scalable server-side applications...',
        tags: ['nestjs', 'typescript', 'backend'],
        readTime: 8,
      },
      a002: {
        id: 'a002',
        title: 'MCP Protocol Explained',
        author: 'Alex Johnson',
        published: '2023-09-01T14:15:00Z',
        content:
          'The Model Context Protocol (MCP) provides a standardized way for AI models to communicate with external systems...',
        tags: ['ai', 'protocol', 'integration'],
        readTime: 12,
      },
    };

    const article = articles[params.articleId] || {
      id: params.articleId,
      title: 'Article Not Found',
      author: 'Unknown',
      published: new Date().toISOString(),
      content: 'The requested article could not be found.',
      tags: [],
      readTime: 0,
    };

    return {
      uri: `resource://blog/articles/${params.articleId}/content`,
      contents: [
        {
          uri: `resource://blog/articles/${params.articleId}/content`,
          text: JSON.stringify(article),
        },
      ],
    };
  }
}
