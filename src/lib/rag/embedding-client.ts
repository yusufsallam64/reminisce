import { EmbeddingRequest, EmbeddingResponse, EmbeddingServiceHealth, RAGError } from './types';

export class EmbeddingClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(
    baseUrl: string = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8080',
    timeout: number = 30000,
    maxRetries: number = 3
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new RAGError(
            `Embedding service error: ${response.status} - ${errorText}`,
            'EMBEDDING_SERVICE_ERROR',
            { status: response.status, statusText: response.statusText }
          );
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof RAGError) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new RAGError(
            `Embedding service timeout after ${this.timeout}ms`,
            'EMBEDDING_SERVICE_ERROR'
          );
        }

        if (attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new RAGError(
      `Failed to connect to embedding service after ${this.maxRetries} attempts: ${lastError.message}`,
      'EMBEDDING_SERVICE_ERROR',
      { originalError: lastError }
    );
  }

  async getHealth(): Promise<EmbeddingServiceHealth> {
    return this.makeRequest<EmbeddingServiceHealth>('/health');
  }

  async embedTexts(texts: string[], model?: string): Promise<EmbeddingResponse> {
    if (!texts || texts.length === 0) {
      throw new RAGError('No texts provided for embedding', 'VALIDATION_ERROR');
    }

    // Validate text lengths (BGE-M3 supports up to 8192 tokens)
    const maxLength = 8000; // Conservative limit to account for tokenization
    const oversizedTexts = texts.filter(text => text.length > maxLength);
    if (oversizedTexts.length > 0) {
      throw new RAGError(
        `Text too long for embedding. Maximum length: ${maxLength} characters`,
        'VALIDATION_ERROR',
        { oversizedCount: oversizedTexts.length }
      );
    }

    const request: EmbeddingRequest = {
      texts,
      model: model || 'BAAI/bge-m3'
    };

    return this.makeRequest<EmbeddingResponse>('/embed', 'POST', request);
  }

  async embedSingle(text: string, model?: string): Promise<number[]> {
    const response = await this.embedTexts([text], model);
    return response.embeddings[0];
  }

  async validateConnection(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }

  async waitForService(maxWaitTime: number = 60000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 2000;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const isHealthy = await this.validateConnection();
        if (isHealthy) {
          return;
        }
      } catch {
        // Continue checking
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new RAGError(
      `Embedding service did not become available within ${maxWaitTime}ms`,
      'EMBEDDING_SERVICE_ERROR'
    );
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }
}

// Default singleton instance
export const embeddingClient = new EmbeddingClient();