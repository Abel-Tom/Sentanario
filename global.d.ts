declare namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'Development' | 'Production' | 'Test';
      OPEN_AI_API_KEY: string;
      IP_GEOLATION_API_KEY: string;
      HOST: string;
      PORT:number;
      NODE_MAILER_USERNAME: string;
      PASSWORD: string;
      // Add other environment variables here
    }
  }
 