import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bot, Key, Plus, Trash2, FileText, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

const Settings = () => {
  const { isAdmin, supabase, user } = useAuth();
  
  // AI Settings state
  const [aiKeys, setAiKeys] = useState<any[]>([]);
  const [ragDocuments, setRagDocuments] = useState<any[]>([]);
  const [newApiKey, setNewApiKey] = useState({
    provider: 'openai',
    apiKey: '',
    keyName: ''
  });
  const [newRagDoc, setNewRagDoc] = useState({
    title: '',
    content: '',
    tags: ''
  });
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [loadingAiData, setLoadingAiData] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  useEffect(() => {
    loadAiData();
  }, []);

  // AI Settings handlers
  const loadAiData = async () => {
    setLoadingAiData(true);
    try {
      console.log('🔍 Loading AI data for user...');
      
      // Load API keys
      const { data: keys, error: keysError } = await supabase
        .from('ai_api_keys')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (keysError) {
        console.error('Keys loading error:', keysError);
        throw keysError;
      }
      
      console.log('✅ API keys loaded successfully:', keys);
      setAiKeys(keys || []);

      // Load RAG documents (if admin)
      if (isAdmin) {
        console.log('🔍 User is admin, loading RAG documents...');
        const { data: docs, error: docsError } = await supabase
          .from('rag_documents')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (docsError) {
          console.error('RAG docs loading error:', docsError);
          throw docsError;
        }
        
        console.log('✅ RAG documents loaded successfully:', docs);
        setRagDocuments(docs || []);
      }
    } catch (error) {
      console.error('Error loading AI data:', error);
      toast.error('Failed to load AI settings');
    } finally {
      setLoadingAiData(false);
    }
  };

  const handleAddApiKey = async () => {
    if (!newApiKey.apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    try {
      // Encode the API key (simple base64 encoding for storage)
      const encodedKey = btoa(newApiKey.apiKey);
      
      const { error } = await supabase
        .from('ai_api_keys')
        .insert({
          provider: newApiKey.provider,
          api_key_encrypted: encodedKey,
          api_key_name: newApiKey.keyName || null,
          user_id: user?.id
        });

      if (error) throw error;

      toast.success('API key added successfully!');
      setNewApiKey({ provider: 'openai', apiKey: '', keyName: '' });
      setShowAddKeyModal(false);
      loadAiData();
    } catch (error) {
      console.error('Error adding API key:', error);
      toast.error('Failed to add API key');
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      const { error } = await supabase
        .from('ai_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;

      toast.success('API key deleted successfully!');
      loadAiData();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const handleAddRagDocument = async () => {
    if (!newRagDoc.title.trim() || !newRagDoc.content.trim()) {
      toast.error('Please enter both title and content');
      return;
    }

    try {
      const tags = newRagDoc.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const { error } = await supabase
        .from('rag_documents')
        .insert({
          title: newRagDoc.title,
          content: newRagDoc.content,
          tags: tags,
          uploaded_by: user?.id,
          file_type: 'text'
        });

      if (error) throw error;

      toast.success('Document added successfully!');
      setNewRagDoc({ title: '', content: '', tags: '' });
      setShowAddDocModal(false);
      loadAiData();
    } catch (error) {
      console.error('Error adding document:', error);
      toast.error('Failed to add document');
    }
  };

  const handleDeleteRagDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('rag_documents')
        .update({ is_active: false })
        .eq('id', docId);

      if (error) throw error;

      toast.success('Document deleted successfully!');
      loadAiData();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const toggleApiKeyVisibility = (keyId: string) => {
    setShowApiKey(showApiKey === keyId ? null : keyId);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <span className="text-3xl font-bold text-white">Settings</span>
            </div>
            <p className="text-gray-400">
              Manage your AI provider API keys and knowledge base documents
            </p>
          </div>

          {loadingAiData && (
            <div className="mb-6 flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* API Keys Section */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Key className="mr-3 h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Settings</h2>
              </div>
              <button
                onClick={() => setShowAddKeyModal(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Key
              </button>
            </div>

            <div className="space-y-4">
              {aiKeys.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  No API keys configured. Add one to start using AI chat.
                </p>
              ) : (
                aiKeys.map((key) => (
                  <div key={key.id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-white capitalize">{key.provider}</span>
                            {key.api_key_name && (
                              <span className="text-sm text-gray-400">({key.api_key_name})</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-sm text-gray-400 font-mono">
                              {showApiKey === key.id 
                                ? atob(key.api_key_encrypted) 
                                : '••••••••••••••••••••••••••••••••'
                              }
                            </span>
                            <button
                              onClick={() => toggleApiKeyVisibility(key.id)}
                              className="text-gray-400 hover:text-white"
                            >
                              {showApiKey === key.id ? 
                                <EyeOff className="h-4 w-4" /> : 
                                <Eye className="h-4 w-4" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteApiKey(key.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RAG Documents Section (Admin Only) */}
          {isAdmin && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <FileText className="mr-3 h-6 w-6 text-green-400" />
                  <h2 className="text-xl font-semibold text-white">Knowledge Base Documents</h2>
                </div>
                <button
                  onClick={() => setShowAddDocModal(true)}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Document
                </button>
              </div>

              <div className="space-y-4">
                {ragDocuments.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">
                    No documents uploaded. Add documents to enhance AI responses.
                  </p>
                ) : (
                  ragDocuments.map((doc) => (
                    <div key={doc.id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-green-400" />
                          <div>
                            <h3 className="font-medium text-white">{doc.title}</h3>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                              {doc.content.substring(0, 100)}...
                            </p>
                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {doc.tags.map((tag: string, index: number) => (
                                  <span key={index} className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRagDocument(doc.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add API Key Modal */}
      {showAddKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Add API Key</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
                <select
                  value={newApiKey.provider}
                  onChange={(e) => setNewApiKey({...newApiKey, provider: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                <input
                  type="password"
                  value={newApiKey.apiKey}
                  onChange={(e) => setNewApiKey({...newApiKey, apiKey: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your API key"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Key Name (Optional)</label>
                <input
                  type="text"
                  value={newApiKey.keyName}
                  onChange={(e) => setNewApiKey({...newApiKey, keyName: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Production Key"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddKeyModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddApiKey}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add RAG Document Modal */}
      {showAddDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Add Knowledge Base Document</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={newRagDoc.title}
                  onChange={(e) => setNewRagDoc({...newRagDoc, title: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Document title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Content</label>
                <textarea
                  value={newRagDoc.content}
                  onChange={(e) => setNewRagDoc({...newRagDoc, content: e.target.value})}
                  rows={8}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Document content..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newRagDoc.tags}
                  onChange={(e) => setNewRagDoc({...newRagDoc, tags: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., guide, faq, tutorial"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddDocModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRagDocument}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 