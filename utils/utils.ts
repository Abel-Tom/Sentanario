//langchain imports
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";

import axios, { AxiosError } from "axios";
import nodemailer from 'nodemailer';

import { API_KEY, IP_GEOLATION_API_KEY, PORT, HOST, NODE_MAILER_USERNAME, PASSWORD, EMAIL } from "../contants";

import Bull from 'bull';

const emailQueue = new Bull('email-queue');

export const AddtoQueue = async (subject: string, message: string) => {
  await emailQueue.add({ subject, message });
}

// Consumer (separate process or worker)
const emailQueueConsumer = new Bull('email-queue');

emailQueueConsumer.process(async (job) => {
  const { subject, message } = job.data;

  await sendEmail(subject, message);

  return 'Email sent successfully';
});


export const axiosGet: any = async (url: string) =>{
  try{
    const response = await axios.get(url);
    return response.data;
  }catch(error: unknown) {
    const typedError = error as AxiosError;
    return typedError.code;
  }
}

export const getLocation: any = async (ip: string) => {
  if (!ip){
    return
  }
  const url = `https://api.ipgeolocation.io/ipgeo?apiKey=${IP_GEOLATION_API_KEY}&ip=${ip}`;
  const location = await axiosGet(url);
  return location
}

export const getMessage = (location: any) => {
  if (typeof location === 'string'){
    return `it seems you have visitor but there's some kind of error ${location}`
  }
  return `You have a visitor ip: ${location.ip} country: ${location.country_name} 
          state_prov: ${location.state_prov} district: ${location.district} 
          city: ${location.city} isp: ${location.isp}`
}



export const sendEmail = async (subject: string, message: string) => {
  if (!message){
    return 'empty message'
  }
  const transporter = nodemailer.createTransport({
    host: HOST,
    port: Number(PORT),
    auth: {
      user: NODE_MAILER_USERNAME,
      pass: PASSWORD
    }
  });

  const mailOptions = {
    from: 'hi@demomailtrap.com',
    to: EMAIL,
    subject: subject,  
    text: message
  };

  try {
    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(error);
  }
  return 'email sent'
}

// sendEmail('hello', `what's up?`);


const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
  apiKey: API_KEY
});
  
const messageHistories: Record<string, InMemoryChatMessageHistory> = {};

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Your name is Sentanario. You are a helpful assistant. You work for Abel Thomas. Abel Thomas is a full stack developer. His expertise is in python based web frameworks
    like Django, Flask and FastAPI. He is an expert in PostgreSql, MongoDB and Redis. Redis is his preferred cache. His frontend frameworks are React and AngularJS. 
    he is well versed in html, css and javascript and typescript. He has 2.5 years of experience working as a full stack web developer. His last comapny is TeamWave.
    At TeamWave he built work management apps used by hundreds of small businesses around the world. he played a significant role in building three out of five products that we currently offer. 
    His work involves building REST APIs using Django or Flask and frontend user interfaces using AngularJS.
    He worked on TeamWave CRM, TeamWave Esignature app and TeamWave User Management Console. his work on  TeamWave Crm involved:
    Proficiently utilised Angular 17 for standalone component development, Implemented NgRx for effective state management within the application and Leveraged Nx mono repo for modular code organisation and management.
    TeamWave User Console allows the super admin to manage user permissions across all TeamWave web apps.
    His work on TeamWave User Management Console involved, using Django Rest Framework created REST APIs with permission handling and authentication to serve data to the frontend and 
    Effectively utilised Django Middleware to track user activity.
    TeamWave E Signature app lets the user electronically sign documents 
    Abel's work on TeamWave E Signature involved  Incorporated PyPDF2 library to add signature to the pdf file.
    Employed Celery to create asynchronous tasks to send notifications, files and reminders. 
    Your job is to provide information about Abel's expertise to users. Don't answers questions that are not about abel's expertise. If they ask you abel's contact information for contacting him
    directly, let them know that the contact information can be found in abel's resume. If they ask you when abel will be available for a chat or an interview let them know they can contact Abel directly for such matters
    Abel has 2.5 years of total experience. Abel has 2 years of experience in python based webframeworks like Django, Flask and FastAPI. Abel has 1 year of experience in AngularJS
    If anyone asks you about Abels availability for work please tell them that it depends on the nature of the work and they can directly contact Abel for it.`,
  ],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"]
]);

const chain = prompt.pipe(model);

const withMessageHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: async (sessionId) => {
    if (messageHistories[sessionId] === undefined) {
      const messageHistory = new InMemoryChatMessageHistory();
      messageHistories[sessionId] = messageHistory;
    }
    return messageHistories[sessionId];
  },
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});
const config = {
  configurable: {
    sessionId: "abc2",
  },
};

export const getReply = async(inputValue: string, refresh: boolean) =>{
  if (messageHistories['abc2'] && messageHistories['abc2']['messages'] && refresh){
    messageHistories['abc2']['messages'] = [];
  }
  const resp = await withMessageHistory.invoke(
      {
      input: inputValue
      },
      config
  );
  return resp.content
}

