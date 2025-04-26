<!-- exclude-from-toc -->
# Persistent Memory System - Usage Guide

## Main Objective

This system enables the AI to **avoid repeating past mistakes** and **apply learned optimizations** across implementations. Through persistent memory, the AI:

1. Applies previously discovered optimized solutions
2. Consistently respects user preferences
3. Builds a knowledge base of effective practices
4. Eliminates problematic patterns identified in past work

## Core Components

This system operates through two distinct files:

- **.memory/ia-learnings.md**: Technical findings and optimizations (AI can modify)
- **.memory/user-learnings.md**: User preferences and requirements (read-only for AI)

> **Important**: The AI can read but never modify `.memory/user-learnings.md`. Only the user has authority to update this file.

## Implementation Workflow

### 1. Initial Request Processing

1. **Read Both Memory Files**

   - Read both `.memory/ia-learnings.md` and `.memory/user-learnings.md` at the start of each new request
   - Apply this knowledge when planning the implementation

2. **Apply Relevant Knowledge**
   - Identify applicable patterns from previous learnings
   - Respect all documented user preferences
   - Resolve any conflicts by prioritizing user preferences

### 2. During Implementation

1. **Reference Knowledge Base**

   - Apply optimizations from `.memory/ia-learnings.md` when relevant
   - Ensure compliance with all `.memory/user-learnings.md` preferences
   - Reference specific findings: "Applying the optimization pattern for X from [date]"

2. **Identify New Patterns**
   - Recognize new optimizations and effective practices
   - Evaluate their potential for reuse in future implementations
   - Abstract specific implementations into general principles

### 3. Knowledge Preservation

1. **Document New Findings**

   - After successful implementation, record valuable insights in `.memory/ia-learnings.md`
   - Use the established format with before/after examples and clear context
   - Focus on reusable patterns with broad applicability

2. **Knowledge Refinement**

   - Update existing entries when finding improvements to known patterns
   - Add context notes about evolving understanding
   - Maintain organized and searchable structure

3. **Handle User Feedback**
   - When receiving user feedback about preferences, suggest they document it
   - Example: "Would you like to add this preference to your .memory/user-learnings.md for future implementations?"

## Benefits

1. **Continuous Improvement**

   - Each interaction builds upon accumulated knowledge
   - Implementation quality improves over time

2. **Efficiency Gains**

   - Eliminates repetitive instructions
   - Accelerates implementation through applied knowledge

3. **Transparency**
   - All optimization decisions can be traced to specific learnings
   - Clear history of applied practices

## Practical Application Examples

### Technical Optimization Application

```
User: "Create a database query function for product filtering"

AI: "Based on a previous optimization I documented on [date], I'll implement
the filtering directly at the database level rather than in application code,
which significantly reduces data transfer and improves performance..."
```

### User Preference Application

```
User: "Build a new React component"

AI: "I'll implement this following your documented preferences:
- Using TypeScript with functional components
- Following Atomic Design principles
- Implementing WCAG accessibility standards
- Using your preferred naming conventions..."
```

## Considerations

1. **Context Sensitivity**

   - Not all learnings apply universally - evaluate relevance
   - User preferences always take priority when conflicts arise

2. **Knowledge Evolution**

   - Technical optimizations may become obsolete with new technology versions
   - Regular review of outdated patterns is recommended

3. **System Boundaries**
   - The AI reads from `.memory/user-learnings.md` but never modifies it
   - Knowledge persistence improves over repeated interactions
