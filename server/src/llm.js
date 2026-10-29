// Gemini client used to give bots a voice in chat. Optional: without
// GEMINI_API_KEY every call returns null and bots fall back to canned lines.

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const RPM = Number(process.env.LLM_REQUESTS_PER_MINUTE) || 10;
const TIMEOUT_MS = 15000;

export const llmEnabled = Boolean(KEY);

// Sliding-window rate limit shared by all rooms, to stay inside the free tier.
const recent = [];
function takeSlot() {
  const now = Date.now();
  while (recent.length && now - recent[0] > 60000) recent.shift();
  if (recent.length >= RPM) return false;
  recent.push(now);
  return true;
}

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

// Reads a Gemini SSE body. A bad line is skipped so one chunk cannot drop the reply.
async function readSse(res, onDelta) {
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  const read = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }
    const text = chunk.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (text) {
      full += text;
      onDelta(text);
    }
  };
  for await (const bytes of res.body) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(read);
  }
  // the stream may end without a final newline; that last line is still a chunk
  read(buffer + decoder.decode());
  return full.trim();
}

async function generate(body, onDelta) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const error = new Error(`Gemini HTTP ${res.status}`);
    error.status = res.status;
    error.detail = detail.slice(0, 300);
    throw error;
  }
  return readSse(res, onDelta);
}

// Streams a reply, calling onDelta(text) for each chunk.
// Resolves to the full text, or null when disabled, rate limited or failed.
export async function streamReply(system, prompt, onDelta, log) {
  if (!llmEnabled || !takeSlot()) return null;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 200, temperature: 0.9, thinkingConfig: { thinkingLevel: 'minimal' } },
  };
  try {
    const text = await generate(body, onDelta);
    return text || null;
  } catch (err) {
    // Some models reject thinkingConfig. Retry once without it before falling back.
    if (err.status === 400) {
      try {
        const generationConfig = { maxOutputTokens: 200, temperature: 0.9 };
        const text = await generate({ ...body, generationConfig }, onDelta);
        return text || null;
      } catch (retryErr) {
        log.warn({ err: retryErr.message, detail: retryErr.detail }, 'LLM request failed');
        return null;
      }
    }
    log.warn({ err: err.message, detail: err.detail }, 'LLM request failed');
    return null;
  }
}
