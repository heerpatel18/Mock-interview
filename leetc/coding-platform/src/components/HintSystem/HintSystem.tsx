import React, { useState } from 'react';
import { Hint } from '../../types/types';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

interface HintSystemProps {
  hints: string[];
  solution: {
    approach: string;
    complexity: {
      time: string;
      space: string;
    };
    explanation: string;
  };
}

const HintSystem: React.FC<HintSystemProps> = ({ hints, solution }) => {
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [showSolution, setShowSolution] = useState(false);

  const handleRevealHint = (index: number) => {
    if (!revealedHints.includes(index)) {
      setRevealedHints([...revealedHints, index]);
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#27282f] to-[#242633] rounded-lg shadow-xl p-6 border border-gray-700">
      <div className="flex items-center mb-4">
        <Lightbulb className="h-5 w-5 text-yellow-400 mr-2" />
        <h2 className="text-lg font-semibold text-white">Hints & Solution</h2>
      </div>

      <div className="space-y-4">
        {hints.map((hint, index) => (
          <div key={index} className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
            <button
              onClick={() => handleRevealHint(index)}
              className="w-full flex justify-between items-center text-left"
            >
              <span className="font-medium text-white">
                Hint #{index + 1}
              </span>
              {revealedHints.includes(index) ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {revealedHints.includes(index) && (
              <p className="mt-2 text-gray-300">{hint}</p>
            )}
          </div>
        ))}

        <div className="border-t border-gray-700 pt-4 mt-4">
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="w-full flex justify-between items-center text-left"
          >
            <span className="font-medium text-white">Solution</span>
            {showSolution ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {showSolution && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-medium text-gray-300">Approach:</h3>
                <p className="mt-1 text-gray-400">{solution.approach}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-300">Time Complexity:</h3>
                <p className="mt-1 text-gray-400">{solution.complexity.time}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-300">Space Complexity:</h3>
                <p className="mt-1 text-gray-400">{solution.complexity.space}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-300">Detailed Explanation:</h3>
                <p className="mt-1 text-gray-400">{solution.explanation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HintSystem;