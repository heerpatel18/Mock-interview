import { TestCase, TestResult, Feedback } from '../types/types';
import { Judge0Service } from './judge0Service';
import { WrapperEngine } from './wrapperEngine';

export const evaluateCode = async (
  code: string,
  language: string,
  testCases: TestCase[]
): Promise<{ results: TestResult[]; feedback: Feedback }> => {
  console.log(`🚀 [EvaluationService] Starting code evaluation:`, {
    language,
    testCasesCount: testCases.length,
    codeLength: code.length
  });

  try {
    console.log(`🔧 [EvaluationService] Wrapping code with all test cases...`);
    // Wrap ALL test cases into a single execution
    const wrappedCode = WrapperEngine.wrapCode(code, language, testCases);
    console.log(`✅ [EvaluationService] Code wrapping completed, wrapped code length:`, wrappedCode.length);

    // Get Judge0 language ID
    const languageId = Judge0Service.getLanguageId(language);
    console.log(`🔤 [EvaluationService] Using Judge0 language ID:`, languageId);

    console.log(`📡 [EvaluationService] Submitting to Judge0 with wait=true...`);
    // Submit ONE request to Judge0 with wait=true (get result immediately)
    const judge0Result = await Judge0Service.submitWithWait({
      source_code: wrappedCode,
      language_id: languageId,
      stdin: ''
    });

    console.log(`📊 [EvaluationService] Judge0 execution completed:`, {
      status: judge0Result.status.description,
      time: judge0Result.time,
      hasStdout: !!judge0Result.stdout,
      hasStderr: !!judge0Result.stderr
    });

    // Parse the JSON output containing all test results
    const results: TestResult[] = [];

    if (judge0Result.status.id === 3) { // Accepted
      console.log(`✅ [EvaluationService] Execution successful, parsing results...`);
      try {
        const executionTime = parseFloat(judge0Result.time || '0') * 1000; // Convert to ms
        const memoryUsed = judge0Result.memory || 0;

        // Parse the JSON output from our wrapper
        const output = judge0Result.stdout?.trim() || '';
        console.log(`📄 [EvaluationService] Raw output from execution:`, output.substring(0, 200) + '...');

        const parsedResults = JSON.parse(output);
        console.log(`🔍 [EvaluationService] Parsed ${parsedResults.length} test results`);

        // Process each test case result
        for (let i = 0; i < parsedResults.length; i++) {
          const result = parsedResults[i];
          const testCase = testCases[i];

          console.log(`🧪 [EvaluationService] Test case ${i + 1}:`, {
            passed: result.passed,
            hasError: !!result.error,
            inputLength: result.input?.length
          });

          results.push({
            passed: result.passed,
            input: result.input,
            expectedOutput: result.expected,
            actualOutput: result.error ? `Runtime Error: ${result.error}` : JSON.stringify(result.actual),
            executionTime: Math.round(executionTime / parsedResults.length), // Distribute time across test cases
            memoryUsed: Math.round(memoryUsed / parsedResults.length), // Distribute memory across test cases
            isHidden: testCase.isHidden
          });
        }
      } catch (parseError) {
        console.error(`❌ [EvaluationService] JSON parsing failed:`, parseError);
        // If JSON parsing fails, treat as single output
        const output = judge0Result.stdout?.trim() || '';
        const executionTime = parseFloat(judge0Result.time || '0') * 1000;
        const memoryUsed = judge0Result.memory || 0;

        console.log(`🔄 [EvaluationService] Falling back to simple output parsing`);

        // Create results for all test cases with the same output
        for (const testCase of testCases) {
          const normalizedActual = output.replace(/\s+/g, ' ').trim();
          const normalizedExpected = testCase.expectedOutput.replace(/\s+/g, ' ').trim();
          const passed = normalizedActual === normalizedExpected;

          results.push({
            passed,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: output,
            executionTime: Math.round(executionTime / testCases.length),
            memoryUsed: Math.round(memoryUsed / testCases.length),
            isHidden: testCase.isHidden
          });
        }
      }
    } else {
      console.log(`❌ [EvaluationService] Execution failed with status:`, judge0Result.status.description);
      // Handle compilation/runtime errors
      let errorMessage = '';
      const executionTime = 0;
      const memoryUsed = 0;

      if (judge0Result.status.id === 6) { // Compilation Error
        errorMessage = `Compilation Error: ${judge0Result.compile_output || 'Unknown error'}`;
        console.log(`🔧 [EvaluationService] Compilation error detected`);
      } else if (judge0Result.status.id === 7) { // Runtime Error
        errorMessage = `Runtime Error: ${judge0Result.stderr || 'Unknown error'}`;
        console.log(`💥 [EvaluationService] Runtime error detected`);
      } else if (judge0Result.status.id === 5) { // Time Limit Exceeded
        errorMessage = 'Time Limit Exceeded';
        console.log(`⏰ [EvaluationService] Time limit exceeded`);
      } else {
        errorMessage = `Error: ${judge0Result.status.description}`;
        console.log(`❓ [EvaluationService] Unknown error:`, judge0Result.status.description);
      }

      // Apply the same error to all test cases
      for (const testCase of testCases) {
        results.push({
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: errorMessage,
          executionTime,
          memoryUsed,
          isHidden: testCase.isHidden
        });
      }
    }

    console.log(`🎯 [EvaluationService] Evaluation completed:`, {
      totalTests: results.length,
      passedTests: results.filter(r => r.passed).length,
      failedTests: results.filter(r => !r.passed).length
    });

    const feedback = generateFeedback(code, language, results);
    console.log(`📋 [EvaluationService] Feedback generated`);

    return {
      results,
      feedback
    };
  } catch (error) {
    console.error('❌ [EvaluationService] Evaluation failed:', error);

    // Return error results for all test cases
    const results: TestResult[] = testCases.map(testCase => ({
      passed: false,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: `System Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      executionTime: 0,
      memoryUsed: 0,
      isHidden: testCase.isHidden
    }));

    console.log(`🚨 [EvaluationService] Returning error results for all test cases`);

    return {
      results,
      feedback: generateFeedback(code, language, results)
    };
  }
};

const generateFeedback = (code: string, language: string, results: TestResult[]): Feedback => {
  console.log(`💡 [EvaluationService] Generating feedback for ${results.length} test results`);

  const timeComplexity = 'O(n)'; // This would need AI analysis in a real implementation
  const spaceComplexity = 'O(1)'; // This would need AI analysis in a real implementation

  const suggestions: string[] = [];
  const optimizationTips: string[] = [];

  // Basic feedback based on results
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`📊 [EvaluationService] Test results summary: ${passedCount}/${totalCount} passed`);

  if (passedCount === totalCount) {
    console.log(`🎉 [EvaluationService] All tests passed - adding success feedback`);
    suggestions.push('Great job! All test cases passed.');
  } else if (passedCount > 0) {
    console.log(`👍 [EvaluationService] Partial success - adding progress feedback`);
    suggestions.push(`Good progress! ${passedCount}/${totalCount} test cases passed.`);
  } else {
    console.log(`❌ [EvaluationService] No tests passed - adding debugging feedback`);
    suggestions.push('No test cases passed. Check your logic and try again.');
  }

  // Check for common issues
  const hasRuntimeErrors = results.some(r => r.actualOutput.includes('Runtime Error'));
  const hasCompilationErrors = results.some(r => r.actualOutput.includes('Compilation Error'));

  if (hasRuntimeErrors) {
    console.log(`💥 [EvaluationService] Runtime errors detected`);
    suggestions.push('There are runtime errors in your code. Check for array bounds, null references, or type errors.');
  }

  if (hasCompilationErrors) {
    console.log(`🔧 [EvaluationService] Compilation errors detected`);
    suggestions.push('There are compilation errors. Check your syntax and imports.');
  }

  console.log(`✅ [EvaluationService] Feedback generated:`, {
    suggestionsCount: suggestions.length,
    optimizationTipsCount: optimizationTips.length,
    timeComplexity,
    spaceComplexity
  });

  return {
    timeComplexity,
    spaceComplexity,
    suggestions,
    optimizationTips
  };
};