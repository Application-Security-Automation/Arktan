import axios from 'axios';

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

  async invokeWorkflow(): Promise<DifyWorkflowResponse> {
    try {
      const inputs = {}
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

let difyClient: DifyWorkflowClient | null = new DifyWorkflowClient("app-KRXVPDTeeG08AHR84O579DiW");
difyClient.invokeWorkflow().then((response) => {
    const output = response;
    console.log('Workflow Output:', output);
}).catch((error) => {
    console.error('Error invoking workflow:', error);
});