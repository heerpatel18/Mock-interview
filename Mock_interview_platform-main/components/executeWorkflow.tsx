import { vapi } from "@/lib/vapi.sdk";

export interface WorkflowResponse {
  context: string;
  instructions: string;
  next_steps: string[];
}

export const executeWorkflow = async (userName: string, userId: string): Promise<WorkflowResponse> => {
  try {
    const response = await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
      variableValues: {
        username: userName,
        userid: userId,
      },
    });
    
    return response as WorkflowResponse;
  } catch (error) {
    console.error('Workflow execution failed:', error);
    throw error;
  }
};