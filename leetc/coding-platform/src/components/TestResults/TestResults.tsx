import React from 'react';
import { TestResult, Feedback } from '../../types/types';
import { Badge } from '../ui/Badge';
import { Clock, Cpu, CheckCircle, XCircle } from 'lucide-react';

interface TestResultsProps {
  results: TestResult[];
  isLoading: boolean;
  feedback?: Feedback;
  overallStatus: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Evaluating' | null;
}

const TestResults: React.FC<TestResultsProps> = ({ 
  results, 
  isLoading, 
  feedback,
  overallStatus
}) => {
  const passedCount = results.filter(result => result.passed).length;
  const totalCount = results.length;
  
  const getStatusColor = (status: string | null) => {
    switch(status) {
      case 'Accepted': return 'text-green-400';
      case 'Wrong Answer': return 'text-red-400';
      case 'Time Limit Exceeded': return 'text-yellow-400';
      case 'Runtime Error': return 'text-red-400';
      case 'Evaluating': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-b from-[#27282f] to-[#242633] rounded-lg shadow-xl p-6 animate-pulse border border-gray-700">
        <div className="h-6 bg-gray-700/50 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700/50 rounded w-full"></div>
          <div className="h-4 bg-gray-700/50 rounded w-5/6"></div>
          <div className="h-4 bg-gray-700/50 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-[#27282f] to-[#242633] rounded-lg shadow-xl p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Test Results</h2>
        <div className={`font-medium ${getStatusColor(overallStatus)}`}>
          {overallStatus || 'Not submitted'}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <div className="w-full bg-gray-700/50 rounded-full h-2.5 border border-gray-600">
            <div 
              className={`h-2.5 rounded-full ${passedCount === totalCount ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: `${totalCount > 0 ? (passedCount / totalCount) * 100 : 0}%` }}
            ></div>
          </div>
          <span className="ml-3 text-sm font-medium text-gray-300">
            {passedCount}/{totalCount} tests passed
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div 
            key={index} 
            className={`p-4 rounded-lg border ${result.passed ? 'border-green-800/50 bg-green-900/20' : 'border-red-800/50 bg-red-900/20'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                {result.passed ? 
                  <CheckCircle className="h-5 w-5 text-green-400 mr-2" /> : 
                  <XCircle className="h-5 w-5 text-red-400 mr-2" />
                }
                <span className="font-medium text-white">Test Case {index + 1}</span>
              </div>
              {result.isHidden && <Badge className="bg-gray-700 text-gray-300">Hidden</Badge>}
            </div>
            
            {!result.isHidden && (
              <div className="ml-7 space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-300">Input:</span>
                  <pre className="mt-1 bg-gray-900/50 p-2 rounded text-xs text-gray-300 border border-gray-700">{result.input}</pre>
                </div>
                <div>
                  <span className="font-medium text-gray-300">Expected Output:</span>
                  <pre className="mt-1 bg-gray-900/50 p-2 rounded text-xs text-gray-300 border border-gray-700">{result.expectedOutput}</pre>
                </div>
                <div>
                  <span className="font-medium text-gray-300">Your Output:</span>
                  <pre className="mt-1 bg-gray-900/50 p-2 rounded text-xs text-gray-300 border border-gray-700">{result.actualOutput}</pre>
                </div>
              </div>
            )}
            
            <div className="mt-2 flex ml-7 space-x-4 text-xs text-gray-400">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>{result.executionTime} ms</span>
              </div>
              <div className="flex items-center">
                <Cpu className="h-3 w-3 mr-1" />
                <span>{result.memoryUsed} KB</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {feedback && (
        <div className="mt-6 border-t border-gray-700 pt-4">
          <h3 className="font-medium text-white mb-2">Analysis & Feedback</h3>
          
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-300">Time Complexity:</div>
            <div className="bg-gray-900/50 p-2 rounded text-sm text-gray-300 border border-gray-700">{feedback.timeComplexity}</div>
          </div>
          
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-300">Space Complexity:</div>
            <div className="bg-gray-900/50 p-2 rounded text-sm text-gray-300 border border-gray-700">{feedback.spaceComplexity}</div>
          </div>
          
          {feedback.suggestions.length > 0 && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-300">Suggestions:</div>
              <ul className="list-disc list-inside text-sm pl-2">
                {feedback.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-gray-400">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          
          {feedback.optimizationTips.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-300">Optimization Tips:</div>
              <ul className="list-disc list-inside text-sm pl-2">
                {feedback.optimizationTips.map((tip, index) => (
                  <li key={index} className="text-gray-400">{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestResults;