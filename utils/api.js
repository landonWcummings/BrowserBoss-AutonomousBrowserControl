const API_KEY = 'xai-878bgCDzB9QPqT81n407wMaLIxWZsOzshUn9v6ZR5oTw2mAtAh5OU6Itrx2HuKDV88JCKEZCQg1LxmmR';

// utils/api.js
// This file no longer adds a chrome.runtime.onMessage listener; 
// it just exports the queryXAI function.

const API_URL = 'https://api.x.ai/v1/chat/completions';

// Export an async function to call x.ai
export async function queryXAI(prompt, model = 'grok-2', temperature = 0.7) {
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are Grok, a chatbot dedicated to serving the user in the most precise, technical, and concise manner.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(`Failed to fetch AI response: ${response.status} - ${errorDetails.message}`);
    }

    const data = await response.json();
    // Return the entire data object or just data.choices[0].message, etc.
    return data;
  } catch (error) {
    console.error('Error querying x.ai API:', error.message);
    throw error;
  }
}
