import dotenv from 'dotenv';
dotenv.config();

export const API_KEY: string | undefined= process.env.OPEN_AI_API_KEY; 
export const IP_GEOLATION_API_KEY: string | undefined= process.env.IP_GEOLATION_API_KEY;
export const PORT: string | number | undefined = process.env.PORT;
export const HOST: string | undefined= process.env.HOST; 
export const NODE_MAILER_USERNAME: string | undefined= process.env.NODE_MAILER_USERNAME;
export const PASSWORD: string | undefined= process.env.PASSWORD;

export const EMAIL: string = 'aroniumaurora@gmail.com';
