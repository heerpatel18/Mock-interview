import React from 'react';
import { Problem } from '../../types/types';
import { Badge } from '../ui/Badge';

interface ProblemDisplayProps {
  problem: Problem;
}

const ProblemDisplay: React.FC<ProblemDisplayProps> = ({ problem }) => {
  const difficultyColor = {
    Easy: 'bg-green-900/40 text-green-300',
    Medium: 'bg-yellow-900/40 text-yellow-300',
    Hard: 'bg-red-900/40 text-red-300'
  }[problem.difficulty];

  return (
    <div className="bg-gradient-to-b from-[#27282f] to-[#242633] rounded-lg shadow-xl p-6 mb-6 border border-gray-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
        <h1 className="text-2xl font-bold text-white">{problem.title}</h1>
        <div className="flex gap-2 mt-2 md:mt-0">
          <Badge className={difficultyColor}>{problem.difficulty}</Badge>
          {problem.tags.map(tag => (
            <Badge key={tag} className="bg-blue-900/40 text-blue-300">{tag}</Badge>
          ))}
        </div>
      </div>
      
      <div className="space-y-4">
        <section>
          <h2 className="text-lg font-semibold text-blue-300 mb-2">🎯 Problem Statement</h2>
          <p className="text-gray-300 whitespace-pre-line">{problem.problemStatement}</p>
        </section>
        
        <section>
          <h2 className="text-lg font-semibold text-blue-300 mb-2">💡 Input Format</h2>
          <p className="text-gray-300 whitespace-pre-line">{problem.inputFormat}</p>
        </section>
        
        <section>
          <h2 className="text-lg font-semibold text-blue-300 mb-2">🧾 Output Format</h2>
          <p className="text-gray-300 whitespace-pre-line">{problem.outputFormat}</p>
        </section>
        
        <section>
          <h2 className="text-lg font-semibold text-blue-300 mb-2">✍️ Constraints</h2>
          <pre className="bg-gray-800/50 p-3 rounded text-sm text-gray-300 whitespace-pre-line border border-gray-700">{problem.constraints}</pre>
        </section>
        
        <section>
          <h2 className="text-lg font-semibold text-blue-300 mb-2">🧪 Example Cases</h2>
          {problem.sampleInputs.map((input, index) => (
            <div key={index} className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="mb-2">
                <h3 className="text-sm font-medium text-gray-400">Input:</h3>
                <pre className="bg-gray-900/50 p-2 rounded text-sm text-gray-300 border border-gray-700">{input}</pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400">Output:</h3>
                <pre className="bg-gray-900/50 p-2 rounded text-sm text-gray-300 border border-gray-700">{problem.sampleOutputs[index]}</pre>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default ProblemDisplay;