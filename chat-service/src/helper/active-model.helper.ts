import { TextDecoder } from 'util';
import { fetch } from 'undici';
import { config } from '../config';
import { Conversations } from '../repositories/interfaces';

type ActiveModel = 'gemini_freetier' | 'openai_4_mini' | 'openai_4_regular' | 'openrouter' | 'local_8B';
type OpenAiMessage = { role: string; content: string };
type GeminiMessage = { role: string; parts: { text: string }[] };
type ActiveModelMessages = OpenAiMessage[] | GeminiMessage[];

function assertActiveModel(activeModel: string): ActiveModel {
  if (
    activeModel === 'gemini_freetier' ||
    activeModel === 'openai_4_mini' ||
    activeModel === 'openai_4_regular' ||
    activeModel === 'openrouter' ||
    activeModel === 'local_8B'
  ) {
    return activeModel;
  }

  throw new Error(`Unsupported active model: ${activeModel}`);
}

function formatConversationId(message: Conversations): string {
  const parts: string[] = [];
  if (message.conversation_id != null) {
    parts.push(`[id: ${message.conversation_id}]`);
  }
  if (message.created_dttm) {
    parts.push(`[created: ${message.created_dttm}]`);
  }

  return parts.length > 0 ? `${parts.join(' ')} ` : '';
}

function isGeminiMessages(messages: ActiveModelMessages): messages is GeminiMessage[] {
  return messages.every(message => 'parts' in message);
}

function toGeminiMessages(messages: ActiveModelMessages): GeminiMessage[] {
  if (isGeminiMessages(messages)) {
    return messages;
  }

  let accumulatedContext = '';
  const geminiMessages: GeminiMessage[] = [];

  for (const message of messages) {
    let role = 'user';
    if (message.role === 'assistant') {
      role = 'model';
    }

    if (message.role === 'system') {
      accumulatedContext += `\n${message.role}: ${message.content}`;
      continue;
    }

    let messageContent = message.content;
    if (accumulatedContext !== '') {
      messageContent = `Context:${accumulatedContext}\n\n Question: ${messageContent}`;
      accumulatedContext = '';
    }

    geminiMessages.push({
      parts: [{ text: messageContent }],
      role
    });
  }

  if (accumulatedContext !== '') {
    geminiMessages.push({
      parts: [{ text: `Context:${accumulatedContext}` }],
      role: 'user'
    });
  }

  return geminiMessages.filter(entry =>
    entry.parts?.some(part => part.text && part.text.trim() !== '')
  );
}

function getOpenAiCompatibleRequest(activeModel: ActiveModel, llmMessages: ActiveModelMessages, stream: boolean): {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
} {
  if (activeModel === 'local_8B') {
    return {
      url: config.llm.localUrl,
      headers: { 'Content-Type': 'application/json' },
      payload: {
        model: 'llama4-dolphin-8b',
        messages: llmMessages,
        max_tokens: 4096,
        stream
      }
    };
  }

  if (activeModel === 'openrouter') {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': config.llm.openRouterReferer,
        'Content-Type': 'application/json'
      },
      payload: {
        model: 'deepseek/deepseek-chat:free',
        messages: llmMessages,
        max_tokens: 4096,
        stream
      }
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    payload: {
      model: activeModel === 'openai_4_regular' ? config.llm.openAiRegularModel : config.llm.openAiModel,
      messages: llmMessages,
      max_completion_tokens: 4096,
      stream
    }
  };
}

async function assertOk(response: any, providerName: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new Error(`${providerName} API Error: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
}

export function transform_for_activemodel(
  arrConversations: Conversations[],
  activeModel: string
): ActiveModelMessages {
  const model = assertActiveModel(activeModel);

  if (model === 'gemini_freetier') {
    let accumulatedContext = '';
    let geminiContents: GeminiMessage[] = [];

    for (const message of arrConversations) {
      let role = 'user';

      if (message.role === 'assistant') {
        role = 'model';
      }

      const isContextual =
        message.role === 'system' ||
        message.role.startsWith('rag_') ||
        message.role.startsWith('snow_') ||
        message.role === 'upl data';

      if (isContextual) {
        accumulatedContext += `\n${message.role}: ${message.content}`;
        continue;
      }

      let messageContent = message.content;

      if (['user', 'assistant'].includes(message.role)) {
        messageContent = `${formatConversationId(message)}${messageContent}`;
      }

      if (accumulatedContext !== '') {
        messageContent = `Context:${accumulatedContext}\n\n Question: ${messageContent}`;
        accumulatedContext = '';
      }

      geminiContents.push({
        parts: [{ text: messageContent }],
        role
      });
    }

    geminiContents = geminiContents.filter(entry =>
      entry.parts?.some(part => part.text && part.text.trim() !== '')
    );

    return geminiContents;
  }

  return arrConversations.map(msg => {
    if (['system', 'user', 'assistant'].includes(msg.role)) {
      return {
        role: msg.role,
        content: `${formatConversationId(msg)}${msg.content}`
      };
    }

    const prefix = `[${msg.role.toUpperCase()}]`;
    let sourceInfo = '';

    if (msg.role === 'rag_data' && msg.rag_filename) {
      sourceInfo = ` (Source: ${msg.rag_filename}${msg.rag_chunk_id != null ? ` [chunk ${msg.rag_chunk_id}]` : ''})`;
    } else if (msg.role.includes('upl') && msg.upl_filename) {
      sourceInfo = ` (Source: ${msg.upl_filename})`;
    }

    return {
      role: 'system',
      content: `${prefix}${sourceInfo} ${msg.content}`
    };
  });
}

export async function call_activemodel(
  llmMessages: ActiveModelMessages,
  activeModel: string
): Promise<{ raw: any; content: string }> {
  let response;
  const model = assertActiveModel(activeModel);

  if (model === 'gemini_freetier') {
    const geminiApiKey = config.llm.geminiApiKey;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    const modelName = config.llm.geminiModel;

    const requestPayload = {
      contents: toGeminiMessages(llmMessages),
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.85,
        topP: 0.9,
        topK: 50
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });

    await assertOk(response, 'Gemini');
    const raw = await response.json();
    const content = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { raw, content };
  }

  const request = getOpenAiCompatibleRequest(model, llmMessages, false);
  response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.payload)
  });

  await assertOk(response, model);
  const raw = await response.json();
  const content = raw?.choices?.[0]?.message?.content || '';
  return { raw, content };
}

export async function* stream_activemodel(
  llmMessages: ActiveModelMessages,
  activeModel: string
): AsyncIterable<string> {
  const model = assertActiveModel(activeModel);

  if (model === 'gemini_freetier') {
    const { content } = await call_activemodel(llmMessages, model);
    if (content) {
      yield content;
    }
    return;
  }

  const request = getOpenAiCompatibleRequest(model, llmMessages, true);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.payload)
  });

  await assertOk(response, model);

  if (!response.body) {
    throw new Error(`${model} response body is null`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const jsonString = line.slice(6).trim();
      if (jsonString === '[DONE]') return;

      const parsed = JSON.parse(jsonString);
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}
