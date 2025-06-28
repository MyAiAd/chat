export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model = 'claude-3-haiku-20240307', apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'user' ? 'human' : 'assistant',
        content: msg.content
      }));

    const systemMessage = messages.find((msg) => msg.role === 'system')?.content || '';

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
      const errorData = await response.text();
      console.error('Anthropic API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: `Anthropic API error: ${response.status}`,
        details: errorData
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