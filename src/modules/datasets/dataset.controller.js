import datasetService from "./dataset.service.js";

export const datasetController={
    createDataset:async(req,res)=>{
        const {name,description,price,datasetLabeler,datasetType,datasetFormat}=req.body;
        const file=req.file;
        if(!file) throw new Error("File is required");
        const dataset=await datasetService.createDataset(name,description,price,datasetLabeler,datasetType,datasetFormat,file);
        return res.json(dataset);
    },
    getAllDatasets:async(req,res)=>{
        const datasets=await datasetService.getAllDatasets();
        return res.json(datasets);
    },
    updateDataset:async(req,res)=>{
        const {id}=req.params;
        
    },
    deleteDataset:async(req,res)=>{
    },
    filterDatasets:async(req,res)=>{
    }

}