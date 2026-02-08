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

const SYMBOL_PROMPT = `You are a code parser. Extract all functions, classes, structs, interfaces, types, and enums from the given code.

Rules:
- Return ONLY a JSON array
- Each symbol must have: name, kind (function/class/struct/interface/type/enum/method), startLine, endLine
- Line numbers are 1-indexed
- DO NOT include control flow keywords (if, for, while, switch, etc.)
- DO NOT include bare braces or operators
- Only include actual named declarations

Example output format:
[
  {"name": "MyFunction", "kind": "function", "startLine": 5, "endLine": 15},
  {"name": "MyClass", "kind": "class", "startLine": 20, "endLine": 50}
]

Language: {language}

Code:
{code}

Return ONLY the JSON array, no explanation:`;

export async function extractSymbolsWithLLM(
  code: string,
  language: string
): Promise<ExtractedSymbol[]> {
  if (!NIM_API_KEY) {
    console.warn('NIM_API_KEY not set, falling back to empty symbols');
    return [];
  }

  const prompt = SYMBOL_PROMPT
    .replace('{language}', language)
    .replace('{code}', code.slice(0, 50000)); // Limit code length for context

  try {
    const response = await fetch(NIM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NIM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 16000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('NIM API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content from NIM');
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
        console.error('Failed to parse NIM response');
        return [];
      }
    }

    const symbols = (parsed as ExtractResponse).symbols || (parsed as { symbols?: ExtractedSymbol[] }).symbols || [];
    return symbols.filter(s =>
      s.name &&
      !['if', 'for', 'while', 'switch', 'case', 'else', 'do', 'return', 'break', 'continue'].includes(s.name)
    );
  } catch (error) {
    console.error('Error extracting symbols with LLM:', error);
    return [];
  }
}

// Estimate tokens from character count (rough approximation)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
