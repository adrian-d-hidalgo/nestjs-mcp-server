import { GetPromptResult } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

import { Prompt, Resolver } from '../../src';

@Resolver('prompts')
export class PromptsResolver {
  /**
   * Simple prompt with only a name
   * Use case: Basic functionality that requires no parameters
   */
  @Prompt({
    name: 'greeting',
  })
  basicGreeting(): GetPromptResult {
    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: 'Hello! How can I assist you today?',
          },
        },
      ],
    };
  }

  /**
   * Prompt with name and argsSchema
   * Use case: When you need validated input parameters
   */
  @Prompt({
    name: 'personalized_greeting',
    argsSchema: {
      name: z.string().min(1),
      timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']),
    },
  })
  personalizedGreeting({
    name,
    timeOfDay,
  }: {
    name: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  }): GetPromptResult {
    const greetings = {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Good night',
    };

    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `${greetings[timeOfDay]}, ${name}! How can I assist you today?`,
          },
        },
      ],
    };
  }

  /**
   * Prompt with name and description
   * Use case: When additional context helps the user understand the prompt's purpose
   */
  @Prompt({
    name: 'help_guide',
    description:
      'Provides a general help guide about available system features',
  })
  helpGuide(): GetPromptResult {
    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `
              # System Help Guide

              Here are the main features available:
              - **Account Management**: Update your profile, change settings
              - **Content Creation**: Create and edit documents, media, and more
              - **Collaboration**: Share and work with others
              - **Analytics**: View performance metrics and reports

              For more detailed help, please specify which feature you need assistance with.
            `,
          },
        },
      ],
    };
  }

  /**
   * Comprehensive prompt with all options
   * Use case: Complex functionality requiring validated input and clear explanation
   */
  @Prompt({
    name: 'product_recommendation',
    description:
      'Recommends products based on user preferences and requirements',
    argsSchema: {
      category: z.string(),
      budget: z.string(),
      preferences: z.string().optional(),
    },
  })
  productRecommendation({
    category,
    budget,
    preferences,
  }: {
    category: string;
    budget: string;
    preferences?: string;
  }): GetPromptResult {
    // Parse inputs
    const parsedCategory = category as
      | 'electronics'
      | 'clothing'
      | 'home'
      | 'beauty';
    const parsedBudget = parseFloat(budget);
    const parsedPreferences = preferences
      ? preferences.split(',').map((p) => p.trim())
      : undefined;

    // Mock product recommendations based on input parameters
    const recommendations = {
      electronics: [
        { name: 'Wireless Earbuds', price: 79.99 },
        { name: 'Smart Watch', price: 149.99 },
        { name: 'Bluetooth Speaker', price: 59.99 },
      ],
      clothing: [
        { name: 'Casual T-Shirt', price: 24.99 },
        { name: 'Jeans', price: 49.99 },
        { name: 'Sneakers', price: 89.99 },
      ],
      home: [
        { name: 'Coffee Maker', price: 69.99 },
        { name: 'Throw Blanket', price: 34.99 },
        { name: 'Table Lamp', price: 42.99 },
      ],
      beauty: [
        { name: 'Face Serum', price: 29.99 },
        { name: 'Makeup Palette', price: 54.99 },
        { name: 'Hair Dryer', price: 99.99 },
      ],
    };

    // Filter by budget
    const affordableProducts = recommendations[parsedCategory].filter(
      (product) => product.price <= parsedBudget,
    );

    // Format recommendations
    const productList = affordableProducts
      .map((product) => `- ${product.name}: $${product.price.toFixed(2)}`)
      .join('\n');

    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `Based on your ${parsedCategory} category and budget of $${parsedBudget.toFixed(2)}${
              parsedPreferences
                ? ` with preferences for ${parsedPreferences.join(', ')}`
                : ''
            }, here are my recommendations:\n\n${productList}`,
          },
        },
      ],
    };
  }
}
