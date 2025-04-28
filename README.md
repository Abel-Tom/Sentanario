Sentanario is the chatbot in my portfolio site https://abel-tom.vercel.app/
Visitors can ask Sentanario for my details instead of contacting me directly.

Installation

npm i

constants.ts file 
please replace 
export const API_KEY: string | undefined= process.env.OPEN_AI_API_KEY; //line 4
with 
export const API_KEY: string | undefined= 'your groq api key';

In util/utils.ts file replace line 216 to 238 with your details. So that Sentanario can provide your information to your web page's visitors.

Run
npm start
