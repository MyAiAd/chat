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
  private currentOrganizationId: string | null = null;

  constructor(supabase: SupabaseClient, organizationId?: string) {
    this.supabase = supabase;
    this.currentOrganizationId = organizationId || null;
  }

  // Set organization context for this service instance
  setOrganizationContext(organizationId: string | null) {
    this.currentOrganizationId = organizationId;
    console.log('🏢 AI Service: Organization context set to:', organizationId);
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
      console.log('🔍 RAG Search - Query:', query);
      
      // Extract meaningful keywords from the query
      const keywords = this.extractKeywords(query);
      console.log('🔍 RAG Search - Extracted keywords:', keywords);
      
      if (keywords.length === 0) {
        console.log('⚠️ RAG Search - No keywords extracted, returning empty results');
        return [];
      }

      // Build dynamic search conditions for better matching
      const searchConditions = keywords.map(keyword => 
        `title.ilike.%${keyword}%,content.ilike.%${keyword}%,tags.cs.{${keyword}}`
      );
      
      // Perform the search with organization context
      let dbQuery = this.supabase
        .from('rag_documents')
        .select('*')
        .eq('is_active', true)
        .limit(limit * 2); // Get more results for relevance scoring

      // Apply organization filter if context is set
      if (this.currentOrganizationId) {
        dbQuery = dbQuery.eq('organization_id', this.currentOrganizationId);
        console.log('🏢 RAG Search: Filtering by organization:', this.currentOrganizationId);
      }

      // Apply search conditions
      dbQuery = dbQuery.or(searchConditions.join(','));

      const { data, error } = await dbQuery;

      if (error) {
        console.error('❌ RAG Search - Database error:', error);
        throw error;
      }

      console.log('📊 RAG Search - Raw results count:', data?.length || 0);
      
      if (!data || data.length === 0) {
        console.log('📊 RAG Search - No documents found, trying fallback search');
        return this.fallbackDocumentSearch(query, limit);
      }

      // Score and rank documents by relevance
      const scoredDocuments = this.scoreDocumentRelevance(data, keywords, query);
      console.log('📊 RAG Search - Scored documents:', scoredDocuments.map(d => ({ 
        title: d.title, 
        score: d.relevanceScore 
      })));

      // Return top documents
      const results = scoredDocuments.slice(0, limit);
      console.log('✅ RAG Search - Final results:', results.map(d => d.title));
      
      return results;
    } catch (error) {
      console.error('❌ RAG Search - Error retrieving documents:', error);
      return [];
    }
  }

  // Extract meaningful keywords from user query
  private extractKeywords(query: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 
      'above', 'below', 'between', 'among', 'is', 'am', 'are', 'was', 'were', 'be', 
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'what', 'when', 
      'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'i', 
      'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to 10 keywords
  }

  // Fallback search for when primary search fails
  private async fallbackDocumentSearch(query: string, limit: number): Promise<RAGDocument[]> {
    try {
      console.log('🔄 RAG Fallback - Trying broader search');
      
      // Try searching with individual words
      const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      
      if (words.length === 0) {
        // Last resort: get most recent documents
        let recentQuery = this.supabase
          .from('rag_documents')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        // Apply organization filter if context is set
        if (this.currentOrganizationId) {
          recentQuery = recentQuery.eq('organization_id', this.currentOrganizationId);
        }

        const { data, error } = await recentQuery;
          
        console.log('🔄 RAG Fallback - Using recent documents:', data?.length || 0);
        return data || [];
      }

      const fallbackConditions = words.map(word => 
        `title.ilike.%${word}%,content.ilike.%${word}%`
      );

      let fallbackQuery = this.supabase
        .from('rag_documents')
        .select('*')
        .eq('is_active', true)
        .limit(limit);

      // Apply organization filter if context is set
      if (this.currentOrganizationId) {
        fallbackQuery = fallbackQuery.eq('organization_id', this.currentOrganizationId);
      }

      // Apply fallback search conditions
      fallbackQuery = fallbackQuery.or(fallbackConditions.join(','));

      const { data, error } = await fallbackQuery;

      if (error) throw error;
      
      console.log('🔄 RAG Fallback - Found documents:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ RAG Fallback - Error:', error);
      return [];
    }
  }

  // Score documents based on relevance to query
  private scoreDocumentRelevance(documents: any[], keywords: string[], originalQuery: string): any[] {
    return documents.map(doc => {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      const queryLower = originalQuery.toLowerCase();
      
      // Exact query match in title (highest score)
      if (titleLower.includes(queryLower)) {
        score += 100;
      }
      
      // Exact query match in content
      if (contentLower.includes(queryLower)) {
        score += 50;
      }
      
      // Keyword matches in title
      keywords.forEach(keyword => {
        if (titleLower.includes(keyword)) {
          score += 10;
        }
        if (contentLower.includes(keyword)) {
          score += 3;
        }
      });
      
      // Tag matches
      if (doc.tags && Array.isArray(doc.tags)) {
        keywords.forEach(keyword => {
          if (doc.tags.some((tag: string) => tag.toLowerCase().includes(keyword))) {
            score += 15;
          }
        });
      }
      
      // Boost score for shorter content (more focused)
      if (doc.content.length < 1000) {
        score += 5;
      }
      
      return { ...doc, relevanceScore: score };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Generate context from RAG documents
  private generateContext(documents: RAGDocument[]): string {
    if (documents.length === 0) {
      console.log('📝 RAG Context - No documents to include in context');
      return '';
    }

    console.log('📝 RAG Context - Generating context from', documents.length, 'documents');
    
    const context = documents
      .map((doc, index) => {
        const truncatedContent = doc.content.length > 1500 
          ? doc.content.substring(0, 1500) + '...' 
          : doc.content;
        
        return `Document ${index + 1}:
Title: ${doc.title}
Content: ${truncatedContent}
${doc.tags && doc.tags.length > 0 ? `Tags: ${doc.tags.join(', ')}` : ''}`;
      })
      .join('\n\n---\n\n');

    const fullContext = `You have access to the following relevant documentation. Please use this information to provide accurate and helpful responses:

${context}

IMPORTANT: When answering, reference the specific documents above when relevant and provide accurate information based on the documentation provided.`;

    console.log('📝 RAG Context - Generated context length:', fullContext.length);
    return fullContext;
  }

  // Call OpenAI API via proxy
  async callOpenAI(messages: ChatMessage[], model: string = 'gpt-4o-mini'): Promise<string> {
    const apiKey = await this.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model,
        apiKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || 'No response generated';
  }

  // Call Anthropic API via proxy
  async callAnthropic(messages: ChatMessage[], model: string = 'claude-3-5-haiku-20241022'): Promise<string> {
    const apiKey = await this.getApiKey('anthropic');
    console.log('🔑 Client Debug - Anthropic API Key Retrieved:');
    console.log('🔑 API Key length:', apiKey ? apiKey.length : 0);
    console.log('🔑 API Key prefix:', apiKey ? apiKey.substring(0, 15) + '...' : 'null');
    console.log('🔑 API Key starts with sk-ant-:', apiKey ? apiKey.startsWith('sk-ant-') : false);
    
    if (!apiKey) throw new Error('Anthropic API key not configured');

    const requestPayload = {
      messages,
      model,
      apiKey
    };

    console.log('🔑 Client Debug - Request Payload:');
    console.log('🔑 Model:', model);
    console.log('🔑 Messages count:', messages.length);
    console.log('🔑 Messages preview:', messages.map(m => ({ role: m.role, contentLength: m.content.length })));

    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    console.log('🔑 Client Debug - Response Status:', response.status);
    console.log('🔑 Client Debug - Response Headers:', Object.fromEntries(response.headers));

    if (!response.ok) {
      const errorData = await response.json();
      console.error('🔑 Client Debug - Error Response:', errorData);
      throw new Error(errorData.error || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('🔑 Client Debug - Success Response:', data);
    return data.response || 'No response generated';
  }

  // Call OpenRouter API via proxy
  async callOpenRouter(messages: ChatMessage[], model: string = 'meta-llama/llama-3.1-8b-instruct'): Promise<string> {
    const apiKey = await this.getApiKey('openrouter');
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const response = await fetch('/api/openrouter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model,
        apiKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || 'No response generated';
  }

  // Main method to generate AI response with RAG
  async generateResponse(
    query: string,
    provider: string,
    model: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<{ response: string; ragDocuments: string[]; ragFound: boolean }> {
    try {
      // Retrieve relevant RAG documents
      const ragDocuments = await this.retrieveRelevantDocuments(query);
      const context = this.generateContext(ragDocuments);

      // Prepare messages with context
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a helpful AI assistant with access to a knowledge base of documents. 

IMPORTANT INSTRUCTIONS:
1. Always prioritize information from the provided documents when answering questions
2. If the documents contain relevant information, use it and cite which document you're referencing
3. If the documents don't contain relevant information, clearly state this and provide general assistance
4. Be specific about which document sections you're referencing
5. Don't make up information that isn't in the provided documents

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
        ragDocuments: ragDocuments.map(doc => doc.id),
        ragFound: ragDocuments.length > 0
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

  // Test RAG functionality - useful for debugging
  async testRAGSearch(query: string): Promise<{
    keywords: string[];
    documents: RAGDocument[];
    context: string;
  }> {
    console.log('🧪 Testing RAG search for query:', query);
    
    const keywords = this.extractKeywords(query);
    const documents = await this.retrieveRelevantDocuments(query, 5);
    const context = this.generateContext(documents);
    
    return {
      keywords,
      documents,
      context
    };
  }

  // Get all documents for admin review (organization-scoped)
  async getAllDocuments(): Promise<RAGDocument[]> {
    try {
      let docsQuery = this.supabase
        .from('rag_documents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Apply organization filter if context is set
      if (this.currentOrganizationId) {
        docsQuery = docsQuery.eq('organization_id', this.currentOrganizationId);
        console.log('🏢 Getting documents for organization:', this.currentOrganizationId);
      }

      const { data, error } = await docsQuery;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting all documents:', error);
      return [];
    }
  }

  // Get all available models for a provider
  getAvailableModels(provider: string): string[] {
    const models = {
      openai: [
        'gpt-4o-mini',       // Small: Fast & cost-effective
        'gpt-4o',            // Mid: Balanced performance  
        'gpt-4-turbo'        // Top: Advanced reasoning
      ],
      anthropic: [
        'claude-3-5-haiku-20241022',  // Small: Fastest model for daily tasks
        'claude-sonnet-4-20250514',   // Mid: Smart, efficient model for everyday use
        'claude-opus-4-20250514'      // Top: Powerful, large model for complex challenges
      ],
      openrouter: [
        'meta-llama/llama-3.1-8b-instruct',  // Small: Fast 8B param model
        'mistralai/mistral-small',           // Mid: 22B param instruction-tuned
        'openai/gpt-4o'                      // Top: OpenAI flagship via OpenRouter
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