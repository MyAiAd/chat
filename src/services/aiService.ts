import { SupabaseClient } from '@supabase/supabase-js';

export interface AIProvider {
  name: string;
  apiKey: string;
  baseUrl?: string;
}

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // Get user's API key for a specific provider
  async getApiKey(provider: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_api_keys')
        .select('api_key_encrypted')
        .eq('provider', provider)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;
      
      // Decrypt the API key (simple base64 decode - in production use proper encryption)
      return atob(data.api_key_encrypted);
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  // Retrieve relevant RAG documents based on query
  async retrieveRelevantDocuments(query: string, limit: number = 5): Promise<RAGDocument[]> {
    try {
      // Simple keyword-based search - in production, use vector embeddings
      const { data, error } = await this.supabase
        .from('rag_documents')
        .select('*')
        .eq('is_active', true)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error retrieving RAG documents:', error);
      return [];
    }
  }

  // Generate context from RAG documents
  private generateContext(documents: RAGDocument[]): string {
    if (documents.length === 0) return '';

    const context = documents
      .map(doc => `Title: ${doc.title}\nContent: ${doc.content}\n`)
      .join('\n---\n');

    return `Here are some relevant documents that might help answer the question:\n\n${context}\n\nPlease use this information to provide a helpful response.`;
  }

  // Call OpenAI API
  async callOpenAI(messages: ChatMessage[], model: string = 'gpt-3.5-turbo'): Promise<string> {
    const apiKey = await this.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  // Call Anthropic API
  async callAnthropic(messages: ChatMessage[], model: string = 'claude-3-haiku-20240307'): Promise<string> {
    const apiKey = await this.getApiKey('anthropic');
    if (!apiKey) throw new Error('Anthropic API key not configured');

    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'human' : 'assistant',
        content: msg.content
      }));

    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: systemMessage,
        messages: anthropicMessages
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text || 'No response generated';
  }

  // Call OpenRouter API
  async callOpenRouter(messages: ChatMessage[], model: string = 'openai/gpt-3.5-turbo'): Promise<string> {
    const apiKey = await this.getApiKey('openrouter');
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Affiliate Platform AI Chat'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  // Main method to generate AI response with RAG
  async generateResponse(
    query: string,
    provider: string,
    model: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<{ response: string; ragDocuments: string[] }> {
    try {
      // Retrieve relevant RAG documents
      const ragDocuments = await this.retrieveRelevantDocuments(query);
      const context = this.generateContext(ragDocuments);

      // Prepare messages with context
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a helpful AI assistant for an affiliate marketing platform. You have access to company documentation and guides. Use the provided context to give accurate, helpful responses about affiliate marketing, commissions, and platform features.

${context}`
        },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        {
          role: 'user',
          content: query
        }
      ];

      let response: string;

      // Call appropriate AI provider
      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(messages, model);
          break;
        case 'anthropic':
          response = await this.callAnthropic(messages, model);
          break;
        case 'openrouter':
          response = await this.callOpenRouter(messages, model);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }

      return {
        response,
        ragDocuments: ragDocuments.map(doc => doc.id)
      };
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }

  // Search RAG documents
  async searchDocuments(query: string): Promise<RAGDocument[]> {
    return this.retrieveRelevantDocuments(query, 10);
  }

  // Get all available models for a provider
  getAvailableModels(provider: string): string[] {
    const models = {
      openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
      anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
      openrouter: [
        'openai/gpt-3.5-turbo',
        'openai/gpt-4',
        'openai/gpt-4-turbo',
        'anthropic/claude-3-haiku',
        'anthropic/claude-3-sonnet',
        'anthropic/claude-3-opus',
        'meta-llama/llama-3.1-70b-instruct',
        'google/gemini-pro'
      ]
    };

    return models[provider as keyof typeof models] || [];
  }

  // Estimate token count (rough approximation)
  estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  // Estimate cost based on provider and model
  estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    // Rough cost estimates (as of 2024) - these should be updated regularly
    const pricing: Record<string, Record<string, { input: number; output: number }>> = {
      openai: {
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }, // per 1K tokens
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-4o': { input: 0.005, output: 0.015 }
      },
      anthropic: {
        'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
        'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
        'claude-3-opus-20240229': { input: 0.015, output: 0.075 }
      },
      openrouter: {
        'openai/gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
        'openai/gpt-4': { input: 0.03, output: 0.06 },
        'anthropic/claude-3-haiku': { input: 0.00025, output: 0.00125 }
      }
    };

    const providerPricing = pricing[provider];
    if (!providerPricing) return 0;

    const modelPricing = providerPricing[model];
    if (!modelPricing) return 0;

    const inputCost = (inputTokens / 1000) * modelPricing.input;
    const outputCost = (outputTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }
} 