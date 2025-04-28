import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

import { Resolver, Tool } from '../../src';

@Resolver('tools')
export class ToolsResolver {
  /**
   * Simple tool with only a name
   * Use case: Basic functionality that requires no parameters
   */
  @Tool({
    name: 'server_health_check',
  })
  healthCheck(): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: 'Server is operational. All systems running normally.',
        },
      ],
    };
  }

  /**
   * Tool with name and parameter schema
   * Use case: When you need validated input parameters
   */
  @Tool({
    name: 'calculate_discount',
    paramSchema: {
      price: z.number().positive().min(0.01),
      discountPercentage: z.number().min(0).max(100),
    },
  })
  calculateDiscount({
    price,
    discountPercentage,
  }: {
    price: number;
    discountPercentage: number;
  }): CallToolResult {
    const discountAmount = price * (discountPercentage / 100);
    const finalPrice = price - discountAmount;

    return {
      content: [
        {
          type: 'text',
          text: `Original price: $${price.toFixed(2)}\nDiscount: $${discountAmount.toFixed(2)} (${discountPercentage}%)\nFinal price: $${finalPrice.toFixed(2)}`,
        },
      ],
    };
  }

  /**
   * Tool with name and description
   * Use case: When additional context helps the user understand the tool's purpose
   */
  @Tool({
    name: 'generate_unique_id',
    description:
      'Generates a cryptographically strong unique identifier suitable for database keys or session tokens',
  })
  generateUniqueId(): CallToolResult {
    // Simple UUID v4 implementation for example purposes
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );

    return {
      content: [
        {
          type: 'text',
          text: `Generated ID: ${uuid}`,
        },
      ],
    };
  }

  /**
   * Comprehensive tool with all options
   * Use case: Complex functionality requiring validated input and clear explanation
   */
  @Tool({
    name: 'weather_forecast',
    description:
      'Retrieves weather forecast for a specified location and timeframe',
    paramSchema: {
      location: z.string().min(2).max(100),
      days: z.number().int().min(1).max(7).default(3),
      tempUnit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    },
  })
  getWeatherForecast({
    location,
    days,
    tempUnit,
  }: {
    location: string;
    days: number;
    tempUnit: 'celsius' | 'fahrenheit';
  }): CallToolResult {
    // Mock weather data for demonstration
    const weatherTypes = [
      'Sunny',
      'Partly Cloudy',
      'Cloudy',
      'Rainy',
      'Thunderstorms',
    ];
    const forecast = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);

      // Generate mock temperature (60-85°F range or 15-30°C range)
      let temp = Math.floor(Math.random() * 15) + 15; // celsius
      if (tempUnit === 'fahrenheit') {
        temp = Math.round((temp * 9) / 5 + 32);
      }

      return {
        date: date.toDateString(),
        condition:
          weatherTypes[Math.floor(Math.random() * weatherTypes.length)],
        temperature: temp,
        unit: tempUnit === 'celsius' ? '°C' : '°F',
      };
    });

    const formattedForecast = forecast
      .map(
        (day) => `${day.date}: ${day.condition}, ${day.temperature}${day.unit}`,
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Weather forecast for ${location} (next ${days} days):\n\n${formattedForecast}`,
        },
      ],
    };
  }

  /**
   * Tool with complex schema validation
   * Use case: When you need sophisticated input validation
   */
  @Tool({
    name: 'register_user',
    description: 'Registers a new user in the system with validation',
    paramSchema: {
      username: z
        .string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/),
      email: z.string().email(),
      age: z.number().int().min(18).optional(),
      preferences: z
        .object({
          theme: z.enum(['light', 'dark', 'system']).default('system'),
          notifications: z.boolean().default(true),
        })
        .optional(),
    },
  })
  registerUser({
    username,
    email,
    age,
    preferences,
  }: {
    username: string;
    email: string;
    age?: number;
    preferences?: {
      theme: 'light' | 'dark' | 'system';
      notifications: boolean;
    };
  }): CallToolResult {
    const userId = Math.floor(10000 + Math.random() * 90000);

    return {
      content: [
        {
          type: 'text',
          text: `User registered successfully!\n
User ID: ${userId}
Username: ${username}
Email: ${email}
${age ? `Age: ${age}` : ''}
${
  preferences
    ? `Theme: ${preferences.theme}
Notifications: ${preferences.notifications ? 'Enabled' : 'Disabled'}`
    : ''
}`,
        },
      ],
    };
  }
}
