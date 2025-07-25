import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bot, Key, Plus, Trash2, FileText, Eye, EyeOff, Search, Building2, Users, Upload, UserX, AlertTriangle } from 'lucide-react';
import { useMultiTenantAuth } from '../hooks/useMultiTenantAuth';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import { AIService } from '../services/aiService';

const Settings = () => {
  const { isOrgAdmin, isSuperAdmin, supabase, user, currentOrganization, userOrganizations, createOrganization, signOut } = useMultiTenantAuth();
  const aiService = new AIService(supabase, currentOrganization?.id);
  const navigate = useNavigate();
  
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
  const [showTestRagModal, setShowTestRagModal] = useState(false);
  const [loadingAiData, setLoadingAiData] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [ragTestQuery, setRagTestQuery] = useState('');
  const [ragTestResults, setRagTestResults] = useState<any>(null);
  const [testingRag, setTestingRag] = useState(false);
  
  // File upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'text' | 'file'>('file');
  
  // Account deletion state
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Super admin promotion state
  const [becomingSuperAdmin, setBecomingSuperAdmin] = useState(false);
  const [isOnlyUser, setIsOnlyUser] = useState(false);
  const [checkingUserCount, setCheckingUserCount] = useState(true);

  useEffect(() => {
    loadAiData();
    checkIfOnlyUser();
  }, []);

  const checkIfOnlyUser = async () => {
    if (isSuperAdmin) {
      setIsOnlyUser(false);
      setCheckingUserCount(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setIsOnlyUser(false);
        setCheckingUserCount(false);
        return;
      }

      // Call a simple check endpoint to see if user can become super admin
      const response = await fetch('/api/check-super-admin-eligibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      setIsOnlyUser(response.ok && result.canBecomeSuperAdmin);
    } catch (error) {
      console.error('Error checking user eligibility:', error);
      setIsOnlyUser(false);
    } finally {
      setCheckingUserCount(false);
    }
  };

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

      // Load RAG documents (if super admin - platform owner only)
      if (isSuperAdmin) {
        console.log('🔍 Super admin loading RAG documents...');
        
        let docsQuery = supabase
          .from('rag_documents')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        // For super admin, show documents from current org if selected, otherwise show all
        if (currentOrganization) {
          docsQuery = docsQuery.eq('organization_id', currentOrganization.id);
          console.log('📂 Filtering documents for organization:', currentOrganization.name);
        } else {
          console.log('📂 Loading all documents (no organization filter)');
        }

        const { data: docs, error: docsError } = await docsQuery;

        if (docsError) {
          console.error('RAG docs loading error:', docsError);
          throw docsError;
        }
        
        console.log('✅ RAG documents loaded successfully:', docs);
        setRagDocuments(docs || []);
      } else {
        console.log('⚠️ User is not super admin, no RAG document access');
        setRagDocuments([]);
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
      // Clean and validate the API key
      const cleanKey = newApiKey.apiKey.trim(); // Remove any whitespace
      
      // Validate key format based on provider
      const keyValidation = {
        openai: cleanKey.startsWith('sk-'),
        anthropic: cleanKey.startsWith('sk-ant-'),
        openrouter: cleanKey.startsWith('sk-or-')
      };
      
      if (!keyValidation[newApiKey.provider as keyof typeof keyValidation]) {
        toast.error(`Invalid ${newApiKey.provider} API key format`);
        return;
      }
      
      // Encode the API key (simple base64 encoding for storage)
      const encodedKey = btoa(cleanKey);
      console.log('🔑 Encoding Debug - Provider:', newApiKey.provider);
      console.log('🔑 Encoding Debug - Original length:', newApiKey.apiKey.length);
      console.log('🔑 Encoding Debug - Clean length:', cleanKey.length);
      console.log('🔑 Encoding Debug - Encoded length:', encodedKey.length);
      console.log('🔑 Encoding Debug - Key prefix:', cleanKey.substring(0, 15) + '...');
      
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

  // Extract text content from uploaded file
  const extractTextFromFile = async (file: File): Promise<{ content: string; title: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const title = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
        resolve({ content, title });
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      // For now, we'll handle text files. Later we can add PDF/Word parsing
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        reject(new Error('Unsupported file type. Please upload .txt or .md files, or use manual text entry.'));
      }
    });
  };

  // Helper function to reset modal state
  const resetRagDocModal = () => {
    setNewRagDoc({ title: '', content: '', tags: '' });
    setSelectedFile(null);
    setUploadMethod('file');
    setUploadingFile(false);
    setShowAddDocModal(false);
  };

  const handleAddRagDocument = async () => {
    setUploadingFile(true);
    
    try {
      let title = newRagDoc.title;
      let content = newRagDoc.content;
      let fileType = 'text';
      let fileSize = null;

      // Handle file upload
      if (uploadMethod === 'file' && selectedFile) {
        if (!selectedFile) {
          toast.error('Please select a file to upload');
          setUploadingFile(false);
          return;
        }
        
        const extracted = await extractTextFromFile(selectedFile);
        title = title.trim() || extracted.title;
        content = extracted.content;
        fileType = selectedFile.type || 'text/plain';
        fileSize = selectedFile.size;
        
        if (!content.trim()) {
          toast.error('The uploaded file appears to be empty');
          setUploadingFile(false);
          return;
        }
      } else if (uploadMethod === 'text') {
        // Handle manual text entry
        if (!title.trim() || !content.trim()) {
          toast.error('Please enter both title and content');
          setUploadingFile(false);
          return;
        }
      }

      const tags = newRagDoc.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const { error } = await supabase
        .from('rag_documents')
        .insert({
          title: title,
          content: content,
          tags: tags,
          uploaded_by: user?.id,
          file_type: fileType,
          file_size: fileSize,
          organization_id: currentOrganization?.id
        });

      if (error) throw error;

      // Success! Close modal and reload data
      toast.success('Document added successfully!');
      
      // Use setTimeout to ensure proper state cleanup and DOM updates
      setTimeout(() => {
        resetRagDocModal();
        loadAiData();
      }, 100);
      
    } catch (error: any) {
      console.error('Error adding document:', error);
      toast.error(`Failed to add document: ${error.message || error}`);
      setUploadingFile(false);
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

  const handleTestRag = async () => {
    if (!ragTestQuery.trim()) {
      toast.error('Please enter a test query');
      return;
    }

    setTestingRag(true);
    try {
      console.log('🧪 Testing RAG with query:', ragTestQuery);
      const results = await aiService.testRAGSearch(ragTestQuery);
      setRagTestResults(results);
      
      if (results.documents.length === 0) {
        toast.warning('No documents found for this query. Try different keywords.');
      } else {
        toast.success(`Found ${results.documents.length} relevant document(s)!`);
      }
    } catch (error) {
      console.error('Error testing RAG:', error);
      toast.error('Failed to test RAG search');
    } finally {
      setTestingRag(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    setDeletingAccount(true);
    try {
      console.log('🗑️ Starting account deletion process for user:', user.id);

      // Get the user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Call our secure API endpoint for account deletion
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account');
      }

      console.log('✅ Account deletion completed successfully');
      toast.success('Account deleted successfully');

      // Sign out and redirect to login
      await signOut();
      navigate('/login');
      
    } catch (error: any) {
      console.error('❌ Error deleting account:', error);
      toast.error(`Failed to delete account: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleBecomeSuperAdmin = async () => {
    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    setBecomingSuperAdmin(true);
    try {
      console.log('🔧 Requesting super admin status for user:', user.id);

      // Get the user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Call our API endpoint to set super admin status
      const response = await fetch('/api/set-super-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to become super admin');
      }

      console.log('✅ Super admin status granted successfully');
      
      if (result.requiresReauth) {
        toast.success('Platform owner status granted! You need to sign out and sign back in for full access.', {
          autoClose: false
        });
        
        // Show a modal or prompt to sign out
        if (confirm('Platform owner privileges granted! You need to sign out and sign back in to access RAG document upload. Sign out now?')) {
          // Sign out the user
          await supabase.auth.signOut();
          // The auth context will handle redirecting to login
        }
      } else {
        toast.success('You are now the Platform Owner! Please refresh the page.');
        
        // Suggest page refresh to pick up new permissions
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
    } catch (error: any) {
      console.error('❌ Error becoming super admin:', error);
      toast.error(`Failed to become platform owner: ${error?.message || 'Unknown error'}`);
    } finally {
      setBecomingSuperAdmin(false);
    }
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

          {/* RAG Documents Section (Platform Owner Only) */}
          {isSuperAdmin && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <FileText className="mr-3 h-6 w-6 text-green-400" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">Knowledge Base Documents</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      {currentOrganization ? `Organization: ${currentOrganization.name} • ` : 'All Organizations • '}{ragDocuments.length} document(s)
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowTestRagModal(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Test Search
                  </button>
                  <button
                    onClick={() => setShowAddDocModal(true)}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Document
                  </button>
                </div>
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
                          {doc.file_type !== 'text' ? (
                            <Upload className="h-5 w-5 text-blue-400" />
                          ) : (
                            <FileText className="h-5 w-5 text-green-400" />
                          )}
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-white">{doc.title}</h3>
                              {doc.file_size && (
                                <span className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
                                  {(doc.file_size / 1024).toFixed(1)} KB
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                              {doc.content.substring(0, 100)}...
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {doc.tags.map((tag: string, index: number) => (
                                    <span key={index} className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <span className="text-xs text-gray-500">
                                {doc.file_type !== 'text' ? 'Uploaded File' : 'Manual Entry'}
                              </span>
                            </div>
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

          {/* RAG Documents Info for Non-Super-Admins - Only show to eligible users */}
          {!isSuperAdmin && (checkingUserCount || isOnlyUser) && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center mb-4">
                <FileText className="mr-3 h-6 w-6 text-gray-400" />
                <h2 className="text-xl font-semibold text-white">Knowledge Base Documents</h2>
              </div>
              <div className="text-center py-6">
                <p className="text-gray-400 mb-2">🔒 Platform Owner Only</p>
                <p className="text-sm text-gray-500 mb-4">
                  Only the platform owner can manage knowledge base documents. These documents enhance AI responses for all users across all organizations.
                </p>
                
                {/* Become Platform Owner Section - Only show if user is the only user */}
                {checkingUserCount ? (
                  <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 mt-4">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                      <span className="text-gray-400">Checking eligibility...</span>
                    </div>
                  </div>
                ) : isOnlyUser ? (
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mt-4">
                    <h3 className="text-blue-300 font-medium mb-2">🚀 Become Platform Owner</h3>
                    <p className="text-sm text-gray-300 mb-3">
                      You are the only user in the system. You can become the platform owner to manage RAG documents and platform-wide settings.
                    </p>
                    <button
                      onClick={handleBecomeSuperAdmin}
                      disabled={becomingSuperAdmin}
                      className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {becomingSuperAdmin ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Becoming Owner...
                        </>
                      ) : (
                        <>
                          <Building2 className="mr-2 h-4 w-4" />
                          Become Platform Owner
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Account Management Section - Danger Zone */}
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6 mt-8">
          <div className="flex items-center mb-6">
            <AlertTriangle className="mr-3 h-6 w-6 text-red-400" />
            <div>
              <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
              <p className="text-sm text-gray-400 mt-1">
                Irreversible account actions
              </p>
            </div>
          </div>

          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-300 mb-2">Delete Account</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Permanently delete your account and all associated data.
                </p>
                <p className="text-xs text-red-400">
                  ⚠️ This action cannot be undone. All your conversations, API keys, and settings will be permanently deleted.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteAccountModal(true)}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors ml-4"
              >
                <UserX className="mr-2 h-4 w-4" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-red-700">
            <div className="flex items-center mb-4">
              <AlertTriangle className="mr-3 h-6 w-6 text-red-400" />
              <h3 className="text-lg font-semibold text-red-400">Delete Account</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-300">
                This action will permanently delete your account and all associated data including:
              </p>
              <ul className="text-sm text-gray-400 space-y-1 ml-4">
                <li>• All conversations and messages</li>
                <li>• All API keys</li>
                <li>• Organization memberships</li>
                <li>• All account settings</li>
              </ul>
              
              <div className="bg-red-900/30 border border-red-700 rounded p-3">
                <p className="text-red-300 text-sm font-medium mb-2">
                  ⚠️ This action cannot be undone!
                </p>
                <p className="text-gray-300 text-sm">
                                      Type <span className="font-mono bg-gray-700 px-1 rounded">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Type here to confirm"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                                      disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            
            {/* Upload Method Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">Upload Method</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="file"
                    checked={uploadMethod === 'file'}
                    onChange={(e) => setUploadMethod(e.target.value as 'file' | 'text')}
                    className="mr-2 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-white">Upload File</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="text"
                    checked={uploadMethod === 'text'}
                    onChange={(e) => setUploadMethod(e.target.value as 'file' | 'text')}
                    className="mr-2 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-white">Manual Text Entry</span>
                </label>
              </div>
            </div>
            
            <div className="space-y-4">
              {uploadMethod === 'file' ? (
                // File Upload Mode
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select File (.txt, .md files supported)
                    </label>
                    <input
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-green-600 file:text-white hover:file:bg-green-700"
                    />
                    {selectedFile && (
                      <p className="text-sm text-gray-400 mt-2">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title (optional - will use filename if empty)
                    </label>
                    <input
                      type="text"
                      value={newRagDoc.title}
                      onChange={(e) => setNewRagDoc({...newRagDoc, title: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Optional custom title"
                    />
                  </div>
                </>
              ) : (
                // Manual Text Entry Mode
                <>
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
                </>
              )}
              
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
                onClick={resetRagDocModal}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRagDocument}
                disabled={uploadingFile}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFile ? 'Processing...' : 'Add Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test RAG Modal */}
      {showTestRagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Test Knowledge Base Search</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Test Query</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={ragTestQuery}
                    onChange={(e) => setRagTestQuery(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter a question to test document retrieval..."
                    onKeyPress={(e) => e.key === 'Enter' && handleTestRag()}
                  />
                  <button
                    onClick={handleTestRag}
                    disabled={testingRag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {testingRag ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>
            </div>

            {ragTestResults && (
              <div className="space-y-4">
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Extracted Keywords:</h4>
                  <div className="flex flex-wrap gap-2">
                    {ragTestResults.keywords.map((keyword: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-blue-900/30 text-blue-300 text-sm rounded">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">
                    Found Documents ({ragTestResults.documents.length}):
                  </h4>
                  {ragTestResults.documents.length === 0 ? (
                    <p className="text-red-400 text-sm">No documents found. Try different keywords or check your document content.</p>
                  ) : (
                    <div className="space-y-2">
                      {ragTestResults.documents.map((doc: any, index: number) => (
                        <div key={doc.id} className="bg-gray-600 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-white">{doc.title}</h5>
                            {doc.relevanceScore && (
                              <span className="text-xs bg-green-900/30 text-green-300 px-2 py-1 rounded">
                                Score: {doc.relevanceScore}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-2">
                            {doc.content.substring(0, 200)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {ragTestResults.context && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Generated Context Preview:</h4>
                    <div className="text-xs text-gray-400 bg-gray-800 rounded p-3 max-h-60 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{ragTestResults.context.substring(0, 1000)}...</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowTestRagModal(false);
                  setRagTestResults(null);
                  setRagTestQuery('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 