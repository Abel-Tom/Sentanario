//langchain imports
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";

import axios, { AxiosError } from "axios";
import nodemailer from 'nodemailer';
import { DateTime } from 'luxon';

import { API_KEY, IP_GEOLATION_API_KEY, PORT, HOST, NODE_MAILER_USERNAME, PASSWORD, EMAIL, UPDATE_TIME, MAX_DB_LENGTH } from "../contants";

import Bull from 'bull';
import { InMemDbItem } from "../interfaces";

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

export const formatMessageAndSendEmail =  async (ip: string | undefined, headers: string | undefined, remoteAddress: string | undefined,) => {
  const currentDate = new Date();
  const now = DateTime.now();
  const year = currentDate.getFullYear();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const day = currentDate.getDate();  
  const hours = currentDate.getHours();
  const minutes = currentDate.getMinutes();
  const seconds = currentDate.getSeconds();  
  const subject: string = `You have a new user on ${monthName}-${day}`
  const message: string = `
                          ip according to request-ip library: ${ip} \n
                          time: ${hours}:${minutes}:${seconds}\n
                          timezone: ${now.zoneName}\n
                          headers: ${headers}\n
                          remote-address: ${remoteAddress}\n
  `
  sendEmail(subject, message)
}

export const DifferenceInMinutes = (startDate: Date, endDate: Date = new Date()): number => {
  const differenceInMilliseconds = endDate.getTime() - startDate.getTime();
  const differenceInMinutes = differenceInMilliseconds / (1000 * 60); 
  return differenceInMinutes
}

export const CreateDate = (dateString: string): Date =>{
  const parts = dateString.split(":");
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date
}

export const CheckDifferenceInMinutes = (dateString: string): Boolean =>{
  const differenceInMinutes: number = DifferenceInMinutes(CreateDate(dateString));
  if (differenceInMinutes>=UPDATE_TIME){
    return true;
  }
  return false;
}

export const CheckLength = (Db: InMemDbItem[], num: number = MAX_DB_LENGTH): Boolean => {
  if (Db.length>=num){
    return true
  }  
  return false
}

export const IsSendEmail = (Db: InMemDbItem[], num: number = MAX_DB_LENGTH): Boolean => {
  if (CheckLength(Db) || CheckDifferenceInMinutes(Db[0].time)){
    return true
  }  
  return false
}

export const sendInteractionReport = async (Db: InMemDbItem[]): Promise<InMemDbItem[]> =>{
  const message: string = JSON.stringify(Db);
  sendEmail("User Interaction with Sentanario", message);
  return [];
}

export const CheckMinutesAndSendMail = async (Db: InMemDbItem[]): Promise<InMemDbItem[]> =>{
  if (!CheckLength(Db,1) || !CheckDifferenceInMinutes(Db[0].time)){
    return Db;
  }
  return await sendInteractionReport(Db);
}

export const CheckLengthAndSendMail = async (Db: InMemDbItem[]): Promise<InMemDbItem[]> =>{
  if (!CheckLength(Db)){
    return Db;
  }
  return await sendInteractionReport(Db);
}

export const getDbItem = (ip: string | string[] | undefined, message: string, reply: any): InMemDbItem => {
  if (!ip){
    ip = "couldn't find ip or you are in dev environment";
  }
  const currentDate = new Date();
  const now = DateTime.now();
  const DbItem: InMemDbItem = {
    ip: ip,
    message: message,
    reply: reply,
    time: `${currentDate.getHours()}:${currentDate.getMinutes()}`,
    date: `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getDate()}`,
    timezone: `${now.zoneName}`
  }
  return DbItem;
}

export const getCronExpression = (minutes: number = UPDATE_TIME): string =>{
  if (minutes===1 || minutes===0){
    return '* * * * *';
  }
  const roundedUp: number = Math.ceil(minutes/60);
  if (roundedUp > 1 && roundedUp < 10){
    return `0 */${roundedUp} * * *`
  }
  return '0 * * * *';
}

export const sendEmail = async (subject: string, message: string) => {
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

