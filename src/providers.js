'use strict';

// Model defaults are current as of this build (mid-2026) — provider lineups move fast,
// override any of them with --model if a default 404s.
const PROVIDER_TYPES = {
  anthropic: { label: 'Anthropic', defaultModel: 'claude-opus-4-8', endpoint: 'https://api.anthropic.com/v1/messages' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-5.6-terra', endpoint: 'https://api.openai.com/v1/chat/completions' },
  google: { label: 'Google (Gemini)', defaultModel: 'gemini-3.5-flash', endpoint: null },
  openrouter: { label: 'OpenRouter', defaultModel: 'openai/gpt-5.6-terra', endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
  local: { label: 'Local (OpenAI-compatible server)', defaultModel: 'local-model', endpoint: null },
};

// unlike the browser artifact, there is no free built-in provider here — every call uses a real
// key from the OS keychain and goes out over a normal server-side HTTP request, so none of the
// CORS uncertainty from the browser version applies. anthropic is just another configured provider.
async function callProvider(entry, key, systemPrompt, userMessage) {
  const type = entry.type;

  if (type === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: entry.model, max_tokens: 1000, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
    });
    if (!res.ok) throw new Error(await httpError(res));
    const data = await res.json();
    const block = (data.content || []).find((b) => b.type === 'text');
    return block ? block.text : '';
  }

  if (type === 'openai' || type === 'openrouter' || type === 'local') {
    const endpoint = type === 'local' ? entry.endpoint : PROVIDER_TYPES[type].endpoint;
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + key;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: entry.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        max_tokens: 1000,
      }),
    });
    if (!res.ok) throw new Error(await httpError(res));
    const data = await res.json();
    const choice = data.choices && data.choices[0];
    return (choice && choice.message && choice.message.content) || '';
  }

  if (type === 'google') {
    const model = entry.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    });
    if (!res.ok) throw new Error(await httpError(res));
    const data = await res.json();
    const cand = data.candidates && data.candidates[0];
    const parts = cand && cand.content && cand.content.parts;
    return parts ? parts.map((p) => p.text || '').join('') : '';
  }

  throw new Error(`unknown provider type: ${type}`);
}

async function httpError(res) {
  let detail = '';
  try { detail = (await res.text()).slice(0, 200); } catch (e) { /* ignore */ }
  return `HTTP ${res.status}${detail ? ': ' + detail : ''}`;
}

module.exports = { PROVIDER_TYPES, callProvider };
