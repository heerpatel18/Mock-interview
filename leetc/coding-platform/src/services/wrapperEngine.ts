export class WrapperEngine {
  static wrapCode(userCode: string, language: string, testCases: any[]): string {
    console.log(`🔧 [WrapperEngine] Starting code wrapping:`, {
      language,
      testCasesCount: testCases.length,
      userCodeLength: userCode.length
    });

    let wrappedCode: string;
    switch (language) {
      case 'javascript':
        wrappedCode = this.wrapJavaScript(userCode, testCases);
        break;
      case 'python':
        wrappedCode = this.wrapPython(userCode, testCases);
        break;
      case 'java':
        wrappedCode = this.wrapJava(userCode, testCases);
        break;
      case 'cpp':
        wrappedCode = this.wrapCpp(userCode, testCases);
        break;
      default:
        console.error(`❌ [WrapperEngine] Unsupported language:`, language);
        throw new Error(`Unsupported language: ${language}`);
    }

    console.log(`✅ [WrapperEngine] Code wrapping completed:`, {
      language,
      wrappedCodeLength: wrappedCode.length,
      testCasesInjected: testCases.length
    });

    return wrappedCode;
  }

  private static wrapJavaScript(userCode: string, testCases: any[]): string {
    console.log(`📝 [WrapperEngine] Wrapping JavaScript code with ${testCases.length} test cases`);

    const functionMatch = userCode.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|var\s+(\w+)\s*=|let\s+(\w+)\s*=)/);
    const functionName = functionMatch
      ? functionMatch[1] || functionMatch[2] || functionMatch[3] || functionMatch[4]
      : 'solution';

    console.log(`🔍 [WrapperEngine] Detected function name:`, functionName);

    const cases = testCases.map(tc => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden || false
    }));

    const wrappedCode = `
${userCode}

const __testCases = ${JSON.stringify(cases)};
const __results = [];

for (const tc of __testCases) {
  try {
    // Parse input: first line is array, second line is target
    const lines = tc.input.trim().split('\\n');
    const nums = lines[0].split(',').map(Number);
    const target = parseInt(lines[1]);

    const output = ${functionName}(nums, target);
    const expected = tc.expectedOutput.trim()
      .replace(/\\[|\\]/g, '')
      .split(',')
      .map(Number);

    const passed = JSON.stringify(output) === JSON.stringify(expected);

    __results.push({
      input: tc.input,
      expected: tc.expectedOutput,
      actual: output,
      passed
    });
  } catch (e) {
    __results.push({
      input: tc.input,
      expected: tc.expectedOutput,
      actual: null,
      error: e.message,
      passed: false
    });
  }
}

console.log(JSON.stringify(__results));
`;

    console.log(`✅ [WrapperEngine] JavaScript wrapping completed`);
    return wrappedCode;
  }

  private static wrapPython(userCode: string, testCases: any[]): string {
    console.log(`🐍 [WrapperEngine] Wrapping Python code with ${testCases.length} test cases`);

    const functionMatch = userCode.match(/def\s+(\w+)/);
    const functionName = functionMatch ? functionMatch[1] : 'solution';
    console.log(`🔍 [WrapperEngine] Detected function name:`, functionName);

    const cases = JSON.stringify(testCases.map(tc => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden || false
    })));

    const wrappedCode = `
import json
import sys

${userCode}

__test_cases = ${cases}
__results = []

for tc in __test_cases:
    try:
        lines = tc['input'].strip().split('\\n')
        nums = list(map(int, lines[0].split(',')))
        target = int(lines[1])

        # SAFE function call
        if '${functionName}' in globals():
            output = ${functionName}(nums, target)
        elif 'Solution' in globals():
            output = Solution().twoSum(nums, target)
        else:
            raise Exception("Function not found")

        # SAFE expected parsing
        expected_str = tc['expectedOutput'].strip().replace('[','').replace(']','')
        expected = []
        if expected_str:
            expected = [int(x.strip()) for x in expected_str.split(',') if x.strip()]

        passed = output == expected

        __results.append({
            'input': tc['input'],
            'expected': tc['expectedOutput'],
            'actual': output,
            'passed': passed
        })

    except Exception as e:
        __results.append({
            'input': tc['input'],
            'expected': tc['expectedOutput'],
            'actual': None,
            'error': str(e),
            'passed': False
        })

print(json.dumps(__results))
`;

    console.log(`✅ [WrapperEngine] Python wrapping completed`);
    return wrappedCode;
  }

  private static wrapJava(userCode: string, testCases: any[]): string {
    const classMatch = userCode.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'Solution';

    const casesJson = JSON.stringify(testCases.map(tc => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput
    }))).replace(/"/g, '\\"');

    return `
import java.util.*;

${userCode}

public class Main {
    public static void main(String[] args) {
        ${className} solution = new ${className}();

        String[][] testData = {
${testCases.map(tc => `            { ${JSON.stringify(tc.input)}, ${JSON.stringify(tc.expectedOutput)} }`).join(',\n')}
        };

        StringBuilder sb = new StringBuilder();
        sb.append("[");

        for (int t = 0; t < testData.length; t++) {
            String inputStr = testData[t][0];
            String expectedStr = testData[t][1];

            try {
                String[] lines = inputStr.trim().split("\\n");
                String[] numStrs = lines[0].split(",");
                int[] nums = new int[numStrs.length];
                for (int i = 0; i < numStrs.length; i++) {
                    nums[i] = Integer.parseInt(numStrs[i].trim());
                }
                int target = Integer.parseInt(lines[1].trim());

                int[] output = solution.twoSum(nums, target);

                // Parse expected [0,1] format
                String cleanExp = expectedStr.trim().replace("[","").replace("]","");
                String[] expParts = cleanExp.split(",");
                int[] expected = new int[expParts.length];
                for (int i = 0; i < expParts.length; i++) {
                    expected[i] = Integer.parseInt(expParts[i].trim());
                }

                boolean passed = Arrays.equals(output, expected);

                if (t > 0) sb.append(",");
                sb.append("{\\"input\\":\\"").append(inputStr.replace("\\n","\\\\n")).append("\\"");
                sb.append(",\\"expected\\":\\"").append(expectedStr).append("\\"");
                sb.append(",\\"actual\\":").append(Arrays.toString(output).replace(" ",""));
                sb.append(",\\"passed\\":").append(passed);
                sb.append("}");

            } catch (Exception e) {
                if (t > 0) sb.append(",");
                sb.append("{\\"input\\":\\"").append(inputStr).append("\\"");
                sb.append(",\\"expected\\":\\"").append(expectedStr).append("\\"");
                sb.append(",\\"actual\\":null");
                sb.append(",\\"error\\":\\"").append(e.getMessage()).append("\\"");
                sb.append(",\\"passed\\":false}");
            }
        }

        sb.append("]");
        System.out.println(sb.toString());
    }
}
`;
  }

  private static wrapCpp(userCode: string, testCases: any[]): string {
    const caseRows = testCases.map(tc =>
      `{ ${JSON.stringify(tc.input)}, ${JSON.stringify(tc.expectedOutput)} }`
    ).join(',\n        ');

    return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
using namespace std;

${userCode}

int main() {
    vector<pair<string,string>> testData = {
        ${caseRows}
    };

    cout << "[";

    for (int t = 0; t < (int)testData.size(); t++) {
        string inputStr = testData[t].first;
        string expectedStr = testData[t].second;

        try {
            // Parse input
            istringstream ss(inputStr);
            string line1, line2;
            getline(ss, line1);
            getline(ss, line2);

            vector<int> nums;
            stringstream ss1(line1);
            string token;
            while (getline(ss1, token, ',')) {
                nums.push_back(stoi(token));
            }
            int target = stoi(line2);

            Solution solution;
            vector<int> output = solution.twoSum(nums, target);

            // Parse expected
            string cleanExp = expectedStr;
            cleanExp.erase(remove(cleanExp.begin(), cleanExp.end(), '['), cleanExp.end());
            cleanExp.erase(remove(cleanExp.begin(), cleanExp.end(), ']'), cleanExp.end());
            vector<int> expected;
            stringstream ss2(cleanExp);
            while (getline(ss2, token, ',')) {
                expected.push_back(stoi(token));
            }

            bool passed = (output == expected);

            if (t > 0) cout << ",";
            cout << "{\\"input\\":\\"" << line1 << "\\\\n" << line2 << "\\"";
            cout << ",\\"expected\\":\\"" << expectedStr << "\\"";
            cout << ",\\"actual\\":[";
            for (int i = 0; i < (int)output.size(); i++) {
                if (i > 0) cout << ",";
                cout << output[i];
            }
            cout << "],\\"passed\\":" << (passed ? "true" : "false") << "}";

        } catch (exception& e) {
            if (t > 0) cout << ",";
            cout << "{\\"input\\":\\"" << inputStr << "\\"";
            cout << ",\\"expected\\":\\"" << expectedStr << "\\"";
            cout << ",\\"actual\\":null,\\"error\\":\\"" << e.what() << "\\"";
            cout << ",\\"passed\\":false}";
        }
    }

    cout << "]" << endl;
    return 0;
}
`;
  }
}