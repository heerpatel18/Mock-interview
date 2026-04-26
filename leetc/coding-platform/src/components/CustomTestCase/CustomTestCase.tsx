import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface CustomTestCaseProps {
  onRunTest: (input: string) => void;
  language: string;
  disabled?: boolean;
}

const CustomTestCase: React.FC<CustomTestCaseProps> = ({
  onRunTest,
  language,
  disabled = false
}) => {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    onRunTest(input);
  };

  return (
    <div className="bg-gradient-to-b from-[#27282f] to-[#242633] rounded-lg shadow-xl overflow-hidden border border-gray-700">
      <div
        className={`bg-gradient-to-r from-[#242633] to-[#1A1C20] px-4 py-2 flex justify-between items-center border-b border-gray-700 ${
          disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
        }`}
        onClick={() => {
          if (!disabled) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <h3 className="font-medium text-white">Custom Test Case</h3>
        <button
          className="text-blue-400 hover:text-blue-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
          disabled={disabled}
        >
          {isExpanded ? 'Hide' : 'Show'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="testInput"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Input
              </label>
              <textarea
                id="testInput"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={disabled}
                className="w-full h-32 p-2 border border-gray-600 rounded-md font-mono text-sm resize-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-gray-900/50 text-gray-100 placeholder-gray-500"
                placeholder={`Enter your ${language} test case input here...\nExample:\n[2,7,11,15]\n9`}
              />
            </div>
            
            <button
              type="submit"
              disabled={disabled}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4 mr-2" />
              Run Test Case
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CustomTestCase;
