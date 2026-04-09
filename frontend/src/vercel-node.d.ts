declare module '@vercel/node' {
  export interface VercelRequest {
    method?: string;
    url?: string;
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  }

  export interface VercelResponse {
    status(code: number): VercelResponse;
    json(body: unknown): void;
  }
}
