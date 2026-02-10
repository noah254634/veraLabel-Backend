import {datasetService} from "./dataset.service.js";

export const datasetController={
    createDataset:async(req,res)=>{
        try{
            console.log("here is the body:",req.body)
        const {name,description,price,datasetType,datasetFormat}=req.body;
        const datasetLabeler=req.user._id;
        const file=req.file;
        if(!file) return res.status(401).json({message:"File is required"});
        const dataset=await datasetService.createDataset(name,description,price,datasetLabeler,datasetType,datasetFormat,file);
        return res.json(dataset);
        }catch(err){
            return res.status(401).json({error:`an error occurred while creating file try again later ${err.message}`})
        }
    },
    getAllDatasets:async(req,res)=>{
        try{
        const datasets=await datasetService.getAllDatasets();
        return res.json(datasets);
        }catch(err){
            return res.status(401).json({error:`an error occurred in getting all the datasets ${err.message}`})
        }
    },
    getDatasetById:async(req,res)=>{
        try{
        const {id}=req.params;
        const dataset=await datasetService.getDatasetById(id);
        return res.json(dataset);
        }catch(err){
            return res.status(404).json({error:err.message});
        }
    },
    updateDataset:async(req,res)=>{
        try{
        const {id}=req.params;
        const data=req.body;
        const dataset=await datasetService.updateDataset(id,data);
        return res.json(dataset);
        }catch(err){
            return res.status(400).json({message:err.message});
        }

    },
    deleteDataset:async(req,res)=>{
        try{
        const {id}=req.params;
        const dataset=await datasetService.deleteDataset(id);
        return res.json(dataset);
        }catch(err){
            return res.status(400).json({message:err.message});
        }
    },
    filterDatasets:async(req,res)=>{
        try{
        const datasets=await datasetService.filterDatasets(req.query);
        return res.json(datasets);
        }catch(err){
            return res.status(400).json({message:err.message});
        }
    }

}
