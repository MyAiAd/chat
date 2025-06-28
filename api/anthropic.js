export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model = 'claude-3-haiku-20240307', apiKey } = req.body;

    console.log('🔑 Anthropic API - Request received');
    console.log('🔑 API Key length:', apiKey ? apiKey.length : 0);
    console.log('🔑 API Key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'null');
    console.log('🔑 Model:', model);
    console.log('🔑 Messages count:', messages ? messages.length : 0);

    if (!apiKey) {
      console.error('❌ No API key provided');
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!messages || !Array.isArray(messages)) {
      console.error('❌ Invalid messages array');
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Convert messages to Anthropic format (modern API)
    const anthropicMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role, // Keep original roles: 'user' and 'assistant'
        content: msg.content
      }));

    const systemMessage = messages.find((msg) => msg.role === 'system')?.content || '';

    console.log('🔑 Anthropic Messages:', anthropicMessages.length, 'messages converted');
    console.log('🔑 System Message length:', systemMessage.length);

    const requestBody = {
      model,
      max_tokens: 1000,
      messages: anthropicMessages
    };

    // Only add system message if it exists
    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    console.log('🔑 Making request to Anthropic API...');
    console.log('🔑 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,  // Use x-api-key instead of Authorization Bearer
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('🔑 Anthropic API response status:', response.status);
    console.log('🔑 Response headers:', Object.fromEntries(response.headers));

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Anthropic API error:', response.status, errorData);
      console.error('❌ Response headers:', Object.fromEntries(response.headers));
      return res.status(response.status).json({ 
        error: `Anthropic API error: ${response.status}`,
        details: errorData,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'null'
      });
    }

    const data = await response.json();
    const responseText = data.content[0]?.text || 'No response generated';

    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 