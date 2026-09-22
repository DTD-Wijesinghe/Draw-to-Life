const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Load local .env file automatically if present
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

const START_PORT = Number(process.env.PORT || 4173);
const DIST = path.join(__dirname, 'dist');

const characters = [
  { name: 'Rocky the Dragon', type: 'A brave little dragon with a big imagination.', speech: 'Hi! I’m Rocky the Dragon!' },
  { name: 'Bloop the Space Cat', type: 'A curious explorer who collects moon rocks.', speech: 'Hello, Earth friend! Want to explore the stars?' },
  { name: 'Zippy the Super Car', type: 'A speedy helper who never leaves a friend behind.', speech: 'Vroom! I’m Zippy. Where should we zoom today?' }
];

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(body);
}

// Fixed 10MB payload limit so high-res base64 images from camera don't break
function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', chunk => {
      data += chunk;
      if (data.length > 10000000) request.destroy();
    });
    request.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || process.env.VISION_API_KEY || '';
}

let cachedGeminiModel = null;

async function getBestGeminiModel(apiKey) {
  if (cachedGeminiModel) return cachedGeminiModel;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];
      const generateModels = models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      const candidates = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-001', 'gemini-1.5-flash', 'gemini-1.5-pro-latest', 'gemini-1.5-pro'];
      for (const candidate of candidates) {
        if (generateModels.includes(candidate)) {
          cachedGeminiModel = candidate;
          console.log(`✦ Selected Gemini Model: ${cachedGeminiModel}`);
          return cachedGeminiModel;
        }
      }
      if (generateModels.length > 0) {
        cachedGeminiModel = generateModels[0];
        console.log(`✦ Selected Available Gemini Model: ${cachedGeminiModel}`);
        return cachedGeminiModel;
      }
    }
  } catch (e) {
    console.error('Failed to query Gemini models endpoint:', e.message);
  }
  cachedGeminiModel = 'gemini-3.6-flash';
  return cachedGeminiModel;
}

// Call Google Gemini API for vision analysis
async function callGeminiVision(base64Data, mimeType, prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VISION_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const model = await getBestGeminiModel(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType || 'image/png', data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: 'application/json'
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini Vision Error (${model}):`, res.status, errText);
    cachedGeminiModel = null;
    throw new Error(`Gemini API HTTP ${res.status}`);
  }
  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return rawText ? JSON.parse(rawText) : null;
}

// Call Google Gemini API for text generation
async function callGeminiText(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || process.env.VISION_API_KEY;
  if (!apiKey) return null;
  const model = await getBestGeminiModel(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

// OpenAI Fallback for Vision
async function callOpenAIVision(dataUrl, prompt) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VISION_API_KEY;
  if (!apiKey) return null;
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return null;
  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content;
  return rawText ? JSON.parse(rawText) : null;
}

// OpenAI Fallback for Text
async function callOpenAIText(prompt) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

function chooseCharacter(fileName = '', source = 'upload') {
  const lower = fileName.toLowerCase();
  if (lower.includes('cat')) return characters[1];
  if (lower.includes('car')) return characters[2];
  if (source === 'camera') return characters[crypto.randomInt(2)];
  return characters[crypto.randomInt(characters.length)];
}

function storyFor(character) {
  return [
    `${character.name} discovered a tiny star tucked inside the drawing.`,
    `“It only shines when someone is brave enough to imagine,” ${character.name.split(' the ')[0]} whispered. Together, you carried it home.`
  ];
}

function replyFor(message, character, language = 'en-US') {
  const text = String(message || '').toLowerCase();
  if (language.startsWith('si')) {
    if (text.includes('name')) return `මගේ නම ${character.name}. මම ඔබගේ චිත්‍රයෙන් ජීවමාන වුණා!`;
    return 'ඒක හරිම ලස්සන අදහසක්! අපි එකට වික්‍රමයකට යමු.';
  }
  if (language.startsWith('ta')) {
    if (text.includes('name')) return `என் பெயர் ${character.name}. உங்கள் ஓவியத்திலிருந்து நான் உயிர் பெற்றேன்!`;
    return 'அது ஒரு அற்புதமான யோசனை! நாம் ஒன்றாக ஒரு சாகசத்திற்கு செல்வோம்.';
  }
  if (text.includes('name')) return `My name is ${character.name}. I was born from your drawing!`;
  if (text.includes('story') || text.includes('adventure')) return 'My best adventure is the one we imagine together. Let’s begin!';
  if (text.includes('hello') || text.includes('hi')) return 'Hello, friend! I’m happy you brought me to life.';
  return `That is a wonderful idea! ${character.name} thinks we should explore it together.`;
}

async function api(request, response, route) {
  try {
    const input = await readBody(request);

    if (route === '/api/scan') {
      const dataUrl = input.drawingDataUrl || '';
      let aiResult = null;

      if (dataUrl && dataUrl.startsWith('data:image/')) {
        const parts = dataUrl.split(',');
        const mimeType = parts[0].match(/data:(image\/[a-zA-Z+]+);/)?.[1] || 'image/png';
        const base64Data = parts[1];

        const prompt = `You are analyzing a child's drawing for an exhibition app where drawings come to life as talking characters.
Look closely at the image to identify what the child drew (e.g., monster, dragon, animal, car, superhero, robot).
Return ONLY a valid JSON object with these exact keys:
- "name": A creative, imaginative name for the character (e.g. "Sparky the Dragon", "Bloop the Monster").
- "type": A 1-sentence description of what it is and its fun personality.
- "speech": An enthusiastic 1-sentence greeting to the child (e.g. "Hi! I'm Sparky! I was born from your drawing!").`;

        try {
          const geminiKey = process.env.GEMINI_API_KEY || process.env.VISION_API_KEY || process.env.LLM_API_KEY;
          const openaiKey = process.env.OPENAI_API_KEY;
          if (geminiKey) {
            aiResult = await callGeminiVision(base64Data, mimeType, prompt);
          } else if (openaiKey) {
            aiResult = await callOpenAIVision(dataUrl, prompt);
          } else {
            console.log('ℹ️ No AI API keys detected in .env. Operating in Mock Mode.');
          }
        } catch (e) {
          console.error('⚠️ Vision AI failed (falling back to Mock Mode):', e.message);
        }
      }

      const base = aiResult || chooseCharacter(input.fileName, input.source);
      return json(response, 200, {
        ok: true,
        mode: aiResult ? 'ai' : 'mock',
        source: input.source || 'upload',
        character: { ...base, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      });
    }

    if (route === '/api/story') {
      const character = input.character || characters[0];
      let aiStory = null;

      const prompt = `Write a short, magical 2-sentence story for a child about a character named "${character.name}" who is described as "${character.type}". The story should be warm and exciting.`;

      try {
        if (getApiKey()) {
          const rawText = (process.env.GEMINI_API_KEY || process.env.LLM_API_KEY?.startsWith('AIza'))
            ? await callGeminiText(prompt)
            : await callOpenAIText(prompt);
          if (rawText) {
            const sentences = rawText.split(/(?<=[.!?])\s+/).filter(Boolean);
            if (sentences.length >= 2) aiStory = sentences.slice(0, 2);
            else if (sentences.length === 1) aiStory = [sentences[0]];
          }
        }
      } catch (e) {
        console.error('Story AI generation error:', e.message);
      }

      return json(response, 200, {
        ok: true,
        mode: aiStory ? 'ai' : 'mock',
        story: aiStory || storyFor(character)
      });
    }

    if (route === '/api/chat') {
      const character = input.character || characters[0];
      const message = input.message || '';
      const language = input.language || 'en-US';
      let aiReply = null;

      const langName = language.startsWith('si') ? 'Sinhala (සිංහල)' : language.startsWith('ta') ? 'Tamil (தமிழ்)' : 'English';
      const prompt = `You are an interactive exhibition character named "${character.name}". Personality: "${character.type}".
A child says: "${message}".
Reply cheerfully as "${character.name}" in 1 short sentence.
IMPORTANT: You MUST write your reply in ${langName}. Stay warmly in character.`;

      try {
        if (getApiKey()) {
          aiReply = (process.env.GEMINI_API_KEY || process.env.LLM_API_KEY?.startsWith('AIza'))
            ? await callGeminiText(prompt)
            : await callOpenAIText(prompt);
        }
      } catch (e) {
        console.error('Chat AI response error:', e.message);
      }

      return json(response, 200, {
        ok: true,
        mode: aiReply ? 'ai' : 'mock',
        reply: aiReply || replyFor(message, character, language)
      });
    }

    return json(response, 404, { ok: false, error: 'Unknown API route' });
  } catch (error) {
    return json(response, 400, { ok: false, error: 'Invalid request' });
  }
}

function serveStatic(request, response) {
  const requested = request.url === '/' ? '/index.html' : request.url;
  const safePath = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(DIST, safePath);
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return json(response, 404, { error: 'Not found' });
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
  response.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') {
    const key = getApiKey();
    return json(response, 200, {
      ok: true,
      service: 'draw-to-life-api',
      mode: key ? 'ai' : 'mock',
      aiConfigured: Boolean(key)
    });
  }
  if (url.pathname.startsWith('/api/')) return api(request, response, url.pathname);
  return serveStatic(request, response);
});

function listen(port) {
  server.once('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy. Trying port ${port + 1}…`);
      listen(port + 1);
    } else {
      throw error;
    }
  });
  server.listen(port, () => console.log(`Draw-to-Life World running at http://localhost:${port}`));
}

listen(START_PORT);

