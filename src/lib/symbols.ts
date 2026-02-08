interface ExtractedSymbol {
  name: string;
  kind: 'function' | 'class' | 'struct' | 'interface' | 'type' | 'enum' | 'method';
  startLine: number;
  endLine: number;
  signature?: string;
}

interface ExtractResponse {
  symbols: ExtractedSymbol[];
  lineCount: number;
}

const NIM_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NIM_API_KEY = process.env.NIM_API_KEY || '';

// Model for symbol extraction - must use models available with your API key
const NIM_MODEL = 'qwen/qwen2.5-coder-32b-instruct';

const SYMBOL_PROMPT = `Extract all functions, classes, structs, interfaces, types, and enums from the code below.

CRITICAL RULES:
1. Return ONLY valid JSON in this exact format: {"symbols": [...]}
2. Each symbol: {{"name": string, "kind": "function|class|struct|interface|type|enum|method", "startLine": number, "endLine": number}}
3. Line numbers are 1-indexed
4. NEVER include: if, for, while, switch, case, else, do, return, break, continue, try, catch
5. Only actual named declarations

Language: {language}

Code (first {codeLength} chars):
{code}

Return ONLY {"symbols": [...]} - no other text:`;

export async function extractSymbolsWithLLM(
  code: string,
  language: string
): Promise<ExtractedSymbol[]> {
  if (!NIM_API_KEY) {
    console.warn('[NIM] NIM_API_KEY not set');
    return [];
  }

  const truncatedCode = code.slice(0, 50000); // Limit for context
  const prompt = SYMBOL_PROMPT
    .replace('{language}', language)
    .replace('{codeLength}', truncatedCode.length.toLocaleString())
    .replace('{code}', truncatedCode);

  console.log('[NIM] Extracting symbols from', language, 'file,', truncatedCode.length, 'chars');

  try {
    const response = await fetch(NIM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NIM_API_KEY}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: NIM_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 16000,
        temperature: 0.1,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NIM] API error:', response.status, response.statusText, errorText);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log('[NIM] Raw response length:', content?.length || 0);

    if (!content) {
      console.error('[NIM] No content in response:', JSON.stringify(data));
      return [];
    }

    // Parse JSON response
    let parsed: ExtractResponse | { symbols?: ExtractedSymbol[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        console.error('[NIM] Failed to parse JSON, response:', content.slice(0, 500));
        return [];
      }
    }

    const symbols = (parsed as ExtractResponse).symbols || (parsed as { symbols?: ExtractedSymbol[] }).symbols || [];
    const filtered = symbols.filter(s =>
      s.name &&
      !['if', 'for', 'while', 'switch', 'case', 'else', 'do', 'return', 'break', 'continue', 'try', 'catch', 'default', 'goto'].includes(s.name)
    );

    console.log('[NIM] Parsed', symbols.length, 'symbols, filtered to', filtered.length);

    return filtered;
  } catch (error) {
    console.error('[NIM] Error:', error);
    return [];
  }
}

// Estimate tokens from character count (rough approximation)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
