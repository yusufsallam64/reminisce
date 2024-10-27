export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
  
export interface AIRequest {
    messages: Message[];
}
  
export interface AIResponse {
    result: {
        response: string;
    };
    success: boolean;
    errors: any[];
    messages: any[];
}
