import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { supportedLanguages } from '../../data/languages';

interface CodeEditorProps {
  initialCode?: string;
  language: string;
  onCodeChange: (code: string) => void;
  onLanguageChange: (language: string) => void;
  isFrozen?: boolean;
}

const defaultCode = {
  javascript: `function solution(nums, target) {
  // Write your code here
  return [0, 1];
}

// Example usage:
// solution([2,7,11,15], 9) should return [0,1]`,
  python: `def solution(nums, target):
    # Write your code here
    return [0, 1]

# Example usage:
# solution([2,7,11,15], 9) should return [0,1]`,
  java: `class Solution {
    public int[] solution(int[] nums, int target) {
        // Write your code here
        return new int[]{0, 1};
    }
}

// Example usage:
// solution([2,7,11,15], 9) should return [0,1]`,
  cpp: `#include <vector>

std::vector<int> solution(std::vector<int>& nums, int target) {
    // Write your code here
    return {0, 1};
}

// Example usage:
// solution([2,7,11,15], 9) should return [0,1]`
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode,
  language,
  onCodeChange,
  onLanguageChange,
  isFrozen = false
}) => {
  const [code, setCode] = useState(initialCode || defaultCode[language as keyof typeof defaultCode] || '');

  useEffect(() => {
    console.log(`📝 [CodeEditor] Initializing code for language: ${language}`);
    if (initialCode) {
      console.log(`📄 [CodeEditor] Using provided initial code, length:`, initialCode.length);
      setCode(initialCode);
    } else {
      const defaultCodeForLang = defaultCode[language as keyof typeof defaultCode] || '';
      console.log(`📝 [CodeEditor] Using default code for ${language}, length:`, defaultCodeForLang.length);
      setCode(defaultCodeForLang);
    }
  }, [language, initialCode]);

  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || '';
    console.log(`✏️ [CodeEditor] Code changed, new length:`, newCode.length);
    setCode(newCode);
    onCodeChange(newCode);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    console.log(`🔄 [CodeEditor] Language changed from ${language} to ${newLanguage}`);
    onLanguageChange(newLanguage);
  };

  const getMonacoLanguage = (lang: string) => {
    switch (lang) {
      case 'cpp': return 'cpp';
      case 'java': return 'java';
      case 'python': return 'python';
      case 'javascript': return 'javascript';
      default: return 'javascript';
    }
  };

  return (
    <div className="flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <select
          value={language}
          onChange={handleLanguageChange}
          className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div className="h-[360px] min-h-[360px] lg:h-[42vh] lg:min-h-[380px]">
        <Editor
          height="100%"
          language={getMonacoLanguage(language)}
          value={code}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            readOnly: isFrozen,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            renderLineHighlight: 'line',
            fixedOverflowWidgets: true,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
