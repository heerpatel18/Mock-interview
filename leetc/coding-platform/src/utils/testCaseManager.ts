import { Problem, TestCase } from '../types/types';

export const prepareTestCases = (problem: Problem): TestCase[] => {
  console.log(`🧪 [TestCaseManager] Preparing test cases for problem:`, problem.title);

  const testCases: TestCase[] = [];

  // Add sample test cases
  console.log(`📋 [TestCaseManager] Adding ${problem.sampleInputs.length} sample test cases`);
  for (let i = 0; i < problem.sampleInputs.length; i++) {
    testCases.push({
      input: problem.sampleInputs[i],
      expectedOutput: problem.sampleOutputs[i],
      isHidden: false
    });
  }

  // Add hidden test cases if available
  if (problem.hiddenInputs && problem.hiddenOutputs) {
    console.log(`🔒 [TestCaseManager] Adding ${problem.hiddenInputs.length} hidden test cases`);
    for (let i = 0; i < problem.hiddenInputs.length; i++) {
      testCases.push({
        input: problem.hiddenInputs[i],
        expectedOutput: problem.hiddenOutputs[i],
        isHidden: true
      });
    }
  }

  console.log(`✅ [TestCaseManager] Total test cases prepared:`, testCases.length);
  return testCases;
};