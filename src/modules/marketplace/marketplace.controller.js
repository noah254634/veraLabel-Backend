import { marketplaceService } from "./marketplace.service.js";

export const marketplaceController={
    createOrder:async(req,res)=>{
        try{
            console.log(req.body);
            const {datasetId,datasetPrice}=req.body;
            const buyerId=req.user._id;
            const response=await marketplaceService.createOrder(buyerId,datasetId,datasetPrice);
            return res.status(200).json({response});
        }catch(err){
            return res.status(500).json({message:err.message})
        }

    },
    alldatasets:async(req,res)=>{
        try{
            const datasets=await marketplaceService.alldatasets()
            return res.status(200).json({datasets});

        }catch(err){
            return res.status(500).json({message:err.message})
        }
    },
       getVerifiedDataset:async(req,res)=>{
        try{
            const datasets=await marketplaceService.getVerifiedDataset()
            return res.status(200).json({datasets});

        }catch(err){
            return res.status(500).json({message:err.message})

        }
       },
       querydatasetByTitle:async(req,res)=>{
        try{
            const {title}=req.query;
            const datasets=await marketplaceService.querydatasetByTitle(title)
            return res.status(200).json({datasets});
        }catch(err){
            return res.status(500).json({message:err.message})
        }
       },
       
             
 }