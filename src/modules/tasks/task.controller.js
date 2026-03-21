import logger from "../../config/logger.js"
import { ENV } from "../../config/env.js"
import { taskService } from "./task.service.js"
export const taskController={
    createTasks:async(req,res)=>{
        try{
           const url = req.headers['handshake-url'] || req.headers['origin'];
           const {projectId,taskFiles}=req.body
           if(!projectId) throw new Error("project id is required")
           if(!taskFiles) throw new Error("task files are required")
           if(url !== ENV().handshake_url) throw new Error("Invalid url")
            const response=await taskService.createTask(projectId,taskFiles)
            
            return res.status(201).json(response);
        }catch(err){
            logger.error(err.message)
            return res.status(500).json({message:err.message})
        }
    

    },
    getTasks:async(req,res)=>{
        try{
            const id=req.params.id;
            const response=await taskService.getTasks(id)
            return res.status(200).json({tasks:response})
        }catch(err){}
    },
    getTaskById:async()=>{},
    returnTaskToPool:async()=>{},
    assignTask:()=>{},
    submitTask:()=>{},
    verifyTask:async()=>{},
    rejectTask:async()=>{},
    deleteTask:async()=>{},
    reviewTask:async()=>{},
    revokeTask:async()=>{},
    autoAssignTask:async()=>{},






}