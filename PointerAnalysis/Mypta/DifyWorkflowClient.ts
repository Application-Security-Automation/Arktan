import axios from 'axios';
import { execSync } from 'child_process';

interface DifyWorkflowResponse {
  data: {
    outputs: Record<string, any>;
    metadata: {
      usage?: {
        total_tokens: number;
      };
    };
  };
}

export class DifyWorkflowClient {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string = 'http://127.0.0.1/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  // 同步调用方法
  invokeWorkflowSync(methodsignature: string): DifyWorkflowResponse | null {
    try {
      const inputs = {"input" : methodsignature}
      const user = "user-1234";
      const postData = JSON.stringify({
        inputs,
        user,
        response_mode: 'blocking'
      });
      
      // 使用curl命令进行同步HTTP请求
      const curlCommand = `curl -X POST "${this.baseURL}/workflows/run" -H "Authorization: Bearer ${this.apiKey}" -H "Content-Type: application/json" -d '${postData}'`;
      
      const response = execSync(curlCommand, { encoding: 'utf8' });
      return JSON.parse(response);
    } catch (error) {
      console.error('调用 Dify 工作流失败:', error);
      return null;
    }
  }
  
  async invokeWorkflow(methodsignature: string): Promise<DifyWorkflowResponse> {
    try {
      const inputs = {"input" : methodsignature}
      const user = "user-1234";
      const response = await axios.post(
        `${this.baseURL}/workflows/run`,
        {
          inputs,
          user,
          response_mode: 'blocking' // 或 'streaming'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('调用 Dify 工作流失败:', error);
      throw error;
    }
  }
}

// let difyClient: DifyWorkflowClient | null = new DifyWorkflowClient("app-KRXVPDTeeG08AHR84O579DiW");
// difyClient.invokeWorkflow().then((response) => {
//     const output = response;
//     console.log('Workflow Output:', output);
// }).catch((error) => {
//     console.error('Error invoking workflow:', error);
// });