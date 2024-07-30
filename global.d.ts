declare namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'Development' | 'Production' | 'Test';
      API_KEY: string;
      PORT: number;
      // Add other environment variables here
    }
  }
  