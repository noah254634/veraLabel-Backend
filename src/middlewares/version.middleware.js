import Dataset from "../modules/datasets/dataset.model.js";
import Version from "../modules/datasets/dataset.version.model.js";
export const prepareDatasetVersion=async(req,res,next)=>{
    try{  
    const {datasetId}=req.params;
    const dataset=await Dataset.findById(datasetId);
    if(!dataset) throw new Error("Dataset not found");
    if(!dataset.datasetLabeler.equals(req.user._id)) throw new Error("You are not the labeler of this dataset");
    req.datasetVersion=dataset.version+1;
    req.datasetId=dataset._id;
    next();

    }catch(err){
        return res.status(400).json({message:err.message});
    }


    
}