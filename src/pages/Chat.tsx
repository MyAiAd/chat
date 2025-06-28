import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Plus, Settings, Key, AlertCircle, Bot, User, FileText, Trash2, RotateCcw, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { AIService } from '../services/aiService';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  ragDocuments?: string[];
  ragFound?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  aiProvider: string;
  modelName?: string;
  created_at: string;
  updated_at: string;
}

interface ApiKey {
  id: string;
  provider: string;
  api_key_name?: string;
  created_at: string;
}

const Chat = () => {
  const { supabase, user } = useAuth();
  const aiService = new AIService(supabase);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  const modelOptions = {
    openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
    openrouter: ['openai/gpt-3.5-turbo', 'openai/gpt-4', 'anthropic/claude-3-haiku', 'anthropic/claude-3-sonnet'],
    anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadApiKeys();
  }, []);

  // Add event listener to close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      setShowMenu(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [showMenu]);

  const loadApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_api_keys')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);

      // Load the most recent conversation if available
      if (data && data.length > 0) {
        setCurrentConversation(data[0]);
        loadMessages(data[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const formattedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        ragDocuments: msg.rag_documents_used
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const createNewConversation = async () => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    console.log('🚀 Creating conversation with user:', {
      userId: user.id,
      userEmail: user.email,
      provider: selectedProvider,
      model: selectedModel
    });

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: 'New Conversation',
          ai_provider: selectedProvider,
          model_name: selectedModel
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Conversation created successfully:', data);

      const newConv: Conversation = {
        id: data.id,
        title: data.title,
        aiProvider: data.ai_provider,
        modelName: data.model_name,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      setConversations(prev => [newConv, ...prev]);
      setCurrentConversation(newConv);
      setMessages([]);
      
      toast.success('New conversation created!');
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      toast.error('Failed to create conversation');
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ is_archived: true })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      if (currentConversation?.id === conversationId) {
        const remainingConversations = conversations.filter(conv => conv.id !== conversationId);
        if (remainingConversations.length > 0) {
          setCurrentConversation(remainingConversations[0]);
          loadMessages(remainingConversations[0].id);
        } else {
          setCurrentConversation(null);
          setMessages([]);
        }
      }

      toast.success('Conversation deleted!');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentConversation || isLoading) return;

    const providerKeys = apiKeys.filter(key => key.provider === selectedProvider);
    if (providerKeys.length === 0) {
      toast.error(`No ${selectedProvider} API key configured. Please add one in Settings.`);
      return;
    }

    setIsLoading(true);

    try {
      // Add user message to UI immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: newMessage,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMessage]);
      setNewMessage('');

      // Save user message to database
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversation.id,
          role: 'user',
          content: newMessage
        });

      if (userMsgError) throw userMsgError;

      // Get conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Generate AI response using the AI service
      const { response: aiResponse, ragDocuments, ragFound } = await aiService.generateResponse(
        newMessage,
        selectedProvider,
        selectedModel,
        conversationHistory
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        ragDocuments,
        ragFound
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to database
      const { error: aiMsgError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversation.id,
          role: 'assistant',
          content: aiResponse,
          rag_documents_used: ragDocuments
        });

      if (aiMsgError) throw aiMsgError;

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = newMessage.slice(0, 50) + (newMessage.length > 50 ? '...' : '');
        const { error: titleError } = await supabase
          .from('chat_conversations')
          .update({ title })
          .eq('id', currentConversation.id);

        if (!titleError) {
          setCurrentConversation(prev => prev ? { ...prev, title } : null);
          setConversations(prev => prev.map(conv => 
            conv.id === currentConversation.id ? { ...conv, title } : conv
          ));
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return '🤖';
      case 'anthropic': return '🎭';
      case 'openrouter': return '🔄';
      default: return '🤖';
    }
  };

  const hasApiKeysConfigured = apiKeys.length > 0;

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* Sidebar - Conversations */}
      <div className="w-80 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            {/* Dropdown Menu replacing MessageCircle */}
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setShowMenu((prev) => !prev); }}
                className="p-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Menu"
              >
                <Menu className="h-5 w-5 text-blue-400" />
              </button>
              {showMenu && (
                <div className="absolute left-0 mt-2 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
                  <a
                    href="/settings"
                    className="block px-4 py-2 text-sm text-white hover:bg-gray-800 rounded-t-lg"
                  >
                    <Settings className="inline-block mr-2 h-4 w-4" />
                    Settings
                  </a>
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold flex items-center">
              {/* <MessageCircle className="mr-2 h-5 w-5 text-blue-400" /> */}
              AI Chat
            </h2>
            <button
              onClick={createNewConversation}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="New Conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Provider and Model Selection */}
          <div className="space-y-2">
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setSelectedModel(modelOptions[e.target.value as keyof typeof modelOptions][0]);
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="anthropic">Anthropic</option>
            </select>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {modelOptions[selectedProvider as keyof typeof modelOptions].map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : conversations.length > 0 ? (
            <div className="p-2 space-y-1">
              {conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversation?.id === conversation.id
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'hover:bg-gray-800'
                  }`}
                  onClick={() => {
                    setCurrentConversation(conversation);
                    loadMessages(conversation.id);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-lg">{getProviderIcon(conversation.aiProvider)}</span>
                        <span className="text-xs text-gray-400 uppercase font-medium">
                          {conversation.aiProvider}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-white truncate">
                        {conversation.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(conversation.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conversation.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-gray-400">
              <MessageCircle className="h-12 w-12 text-gray-600 mb-4" />
              <p className="text-center text-sm">No conversations yet</p>
              <p className="text-center text-xs mt-1">Create your first conversation to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!hasApiKeysConfigured ? (
          // No API Keys State
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <Key className="mx-auto h-16 w-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">API Keys Required</h3>
              <p className="text-gray-400 mb-6">
                To use the AI chat feature, you need to configure at least one AI provider API key.
              </p>
              <a
                href="/settings"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configure API Keys
              </a>
            </div>
          </div>
        ) : !currentConversation ? (
          // No Conversation Selected State
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <Bot className="mx-auto h-16 w-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Start a Conversation</h3>
              <p className="text-gray-400 mb-6">
                Create a new conversation or select an existing one to start chatting with AI.
              </p>
              <button
                onClick={createNewConversation}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Conversation
              </button>
            </div>
          </div>
        ) : (
          // Active Conversation
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getProviderIcon(currentConversation.aiProvider)}</span>
                  <div>
                    <h1 className="text-lg font-semibold text-white">{currentConversation.title}</h1>
                    <p className="text-sm text-gray-400">
                      {currentConversation.aiProvider} • {currentConversation.modelName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => loadMessages(currentConversation.id)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  title="Refresh messages"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <MessageCircle className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    
                    <div
                      className={`max-w-3xl p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.role === 'assistant' && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          {message.ragFound && message.ragDocuments && message.ragDocuments.length > 0 ? (
                            <>
                              <div className="flex items-center text-xs text-gray-400 mb-1">
                                <FileText className="h-3 w-3 mr-1" />
                                Referenced {message.ragDocuments.length} document(s)
                              </div>
                              <div className="text-xs text-green-400">
                                ✓ Answer based on uploaded knowledge base
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-yellow-400">
                              ⚠ No relevant documents found - answer from general knowledge
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-xs mt-2 opacity-70">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>

                    {message.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-800 text-gray-100 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-400">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message... (Shift+Enter for new line)"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={1}
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isLoading}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat; 