import axios from 'axios';
import { supportedLanguages } from '../data/languages';

const JUDGE0_API_BASE = 'https://judge029.p.rapidapi.com';
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || '798c3a86bamsha780d343de8bab8p15c3a6jsnd4f28bcd1a6b';

export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
}

export interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
  status: {
    id: number;
    description: string;
  };
}

export class Judge0Service {
  private static async makeRequest(endpoint: string, data?: any) {
    console.log(`🔄 [Judge0Service] Making ${data ? 'POST' : 'GET'} request to: ${endpoint}`);
    const config = {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'judge029.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    };

    try {
      let response;
      if (data) {
        console.log(`📤 [Judge0Service] POST data:`, { source_code_length: data.source_code?.length, language_id: data.language_id });
        response = await axios.post(`${JUDGE0_API_BASE}${endpoint}`, data, config);
      } else {
        response = await axios.get(`${JUDGE0_API_BASE}${endpoint}`, config);
      }
      console.log(`✅ [Judge0Service] Request successful:`, { status: response.status, endpoint });
      return response;
    } catch (error: any) {
      console.error(`❌ [Judge0Service] Request failed:`, {
        endpoint,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      });
      throw error;
    }
  }

  static async submitWithWait(submission: Judge0Submission): Promise<Judge0Result> {
    console.log(`🚀 [Judge0Service] Starting submitWithWait for language:`, submission.language_id);
    try {
      const response = await this.makeRequest('/submissions?wait=true', {
        ...submission,
        stdin: submission.stdin || ''
      });
      console.log(`🎯 [Judge0Service] submitWithWait completed:`, {
        status: response.data.status,
        time: response.data.time,
        has_stdout: !!response.data.stdout,
        has_stderr: !!response.data.stderr
      });
      return response.data;
    } catch (error) {
      console.error('❌ [Judge0Service] submitWithWait failed:', error);
      throw new Error('Failed to submit code with wait');
    }
  }

  static async getResult(token: string): Promise<Judge0Result> {
    console.log(`🔍 [Judge0Service] Getting result for token:`, token.substring(0, 8) + '...');
    try {
      const response = await this.makeRequest(`/submissions/${token}`);
      console.log(`📊 [Judge0Service] Result status:`, response.data.status);
      return response.data;
    } catch (error) {
      console.error('❌ [Judge0Service] Failed to get result:', error);
      throw new Error('Failed to get result');
    }
  }

  static async waitForResult(token: string, maxRetries = 30): Promise<Judge0Result> {
    console.log(`⏳ [Judge0Service] Starting to wait for result, max retries:`, maxRetries);
    for (let i = 0; i < maxRetries; i++) {
      console.log(`🔄 [Judge0Service] Polling attempt ${i + 1}/${maxRetries}`);
      const result = await this.getResult(token);
      if (result.status.id === 1 || result.status.id === 2) {
        console.log(`⏳ [Judge0Service] Still processing (status ${result.status.id}), waiting 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.log(`✅ [Judge0Service] Result ready! Status:`, result.status.description);
      return result;
    }
    console.error(`❌ [Judge0Service] Timeout after ${maxRetries} retries`);
    throw new Error('Timeout waiting for Judge0 result');
  }

  static getLanguageId(language: string): number {
    console.log(`🔤 [Judge0Service] Getting language ID for:`, language);
    const lang = supportedLanguages.find(l => l.id === language);
    if (!lang) {
      console.error(`❌ [Judge0Service] Unsupported language:`, language);
      throw new Error(`Unsupported language: ${language}`);
    }
    console.log(`✅ [Judge0Service] Language ID:`, lang.judge0Id);
    return lang.judge0Id;
  }
}