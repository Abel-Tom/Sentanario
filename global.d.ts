declare namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'Development' | 'Production' | 'Test';
      SERVER_PORT: number;
      OPEN_AI_API_KEY: string;
      IP_GEOLATION_API_KEY: string;
      HOST: string;
      PORT:number;
      NODE_MAILER_USERNAME: string;
      PASSWORD: string;
      UPDATE_TIME: number;
      MAX_DB_LENGTH: number;
      // Add other environment variables here
    }
  }
 