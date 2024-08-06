import express, { Express, Request, Response } from 'express';
import { cronTask } from "./index"


export const CronJob = async (req: Request,res:Response) =>{
    console.log('cron')
    cronTask()
    res.status(200).json({"Greetings Stranger! ": "We are Express and TypeScript Added  some extra features"});
}