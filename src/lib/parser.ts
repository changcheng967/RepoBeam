// Language detection from file extension
export function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'py': 'python',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'kt': 'kotlin',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'scala': 'scala',
    'sh': 'bash',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'md': 'markdown',
    'txt': 'text',
  };
  return langMap[ext || ''] || 'text';
}

// Regex-based symbol extraction (fallback)
interface ParsedSymbol {
  name: string;
  kind: string;
  signature: string | null;
  startLine: number;
  endLine: number;
  parentSymbol: string | null;
}

const regexPatterns: Record<string, RegExp[]> = {
  c: [
    // Functions
    /^[\s\w\*]+\s+(\w+)\s*\([^)]*\)\s*\{/gm,
    // Structs
    /typedef\s+struct\s+(\w+)/gm,
    /struct\s+(\w+)\s*\{/gm,
  ],
  cpp: [
    // Functions and methods
    /^[\w\s\*&:<>,]+\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{/gm,
    // Classes
    /class\s+(\w+)/gm,
    // Structs
    /struct\s+(\w+)/gm,
    // Namespaces
    /namespace\s+(\w+)/gm,
  ],
  python: [
    // Functions and methods
    /^\s*def\s+(\w+)\s*\(/gm,
    // Classes
    /^\s*class\s+(\w+)/gm,
  ],
  javascript: [
    // Functions
    /function\s+(\w+)\s*\(/gm,
    // Arrow functions with const/let/var
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
    // Methods
    /(\w+)\s*\([^)]*\)\s*\{/gm,
    // Classes
    /class\s+(\w+)/gm,
  ],
  typescript: [
    // Functions
    /function\s+(\w+)\s*\(/gm,
    // Arrow functions
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*:/gm,
    // Methods
    /(\w+)\s*\([^)]*\)\s*[:{]/gm,
    // Interfaces
    /interface\s+(\w+)/gm,
    // Classes
    /class\s+(\w+)/gm,
    // Type aliases
    /type\s+(\w+)\s*=/gm,
  ],
  rust: [
    // Functions
    /fn\s+(\w+)\s*\(/gm,
    // Structs
    /struct\s+(\w+)/gm,
    // Enums
    /enum\s+(\w+)/gm,
    // Traits
    /trait\s+(\w+)/gm,
    // Impl blocks
    /impl\s+(?:\w+\s+for\s+)?(\w+)/gm,
  ],
  go: [
    // Functions
    /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm,
    // Interfaces
    /type\s+(\w+)\s+interface/gm,
    // Structs
    /type\s+(\w+)\s+struct/gm,
  ],
  java: [
    // Classes
    /(?:public\s+)?class\s+(\w+)/gm,
    // Interfaces
    /interface\s+(\w+)/gm,
    // Methods
    /(?:public|private|protected)?\s*(?:static\s+)?\w+\s+(\w+)\s*\(/gm,
  ],
};

export function extractSymbolsRegex(content: string, language: string): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = [];
  const patterns = regexPatterns[language] || regexPatterns.javascript;

  const lines = content.split('\n');

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (!name) continue;

      // Find the line number
      const beforeMatch = content.substring(0, match.index);
      const startLine = beforeMatch.split('\n').length;

      // Determine kind based on the match
      let kind = 'function';
      const matchText = match[0];
      if (matchText.includes('class')) kind = 'class';
      else if (matchText.includes('struct')) kind = 'struct';
      else if (matchText.includes('interface')) kind = 'interface';
      else if (matchText.includes('type') && language === 'typescript') kind = 'type';
      else if (matchText.includes('enum')) kind = 'enum';
      else if (matchText.includes('trait')) kind = 'trait';
      else if (matchText.includes('namespace')) kind = 'namespace';

      // Find end line by counting braces
      let braceCount = 0;
      let foundBrace = false;
      let endLine = startLine;
      for (let i = startLine - 1; i < lines.length; i++) {
        for (const char of lines[i]) {
          if (char === '{') {
            braceCount++;
            foundBrace = true;
          } else if (char === '}') {
            braceCount--;
          }
        }
        if (foundBrace && braceCount === 0) {
          endLine = i + 1;
          break;
        }
      }

      symbols.push({
        name,
        kind,
        signature: match[0].substring(0, 100),
        startLine,
        endLine: endLine + 1,
        parentSymbol: null,
      });
    }
  }

  return symbols;
}

// Count lines in content
export function countLines(content: string): number {
  return content.split('\n').length;
}

// Extract line range from content
export function extractLineRange(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);
  return lines.slice(start, end).join('\n');
}
