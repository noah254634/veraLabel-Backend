import analyticsService from "./analytics.service.js";
const analyticsController = { 
overview:async(req,res)=>{
        const overviewStats=await analyticsService.overview();
        return res.json(overviewStats);
    
    }


}

export default analyticsController;