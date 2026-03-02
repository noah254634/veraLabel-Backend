export const datasetPolicy={
    canUpdate:async(req,res,next)=>{
        const role=req.user.role;
        if(role==="labeler"){
            next();
        }
        else{
            return res.status(401).json({
                error:"You are not authorized to perform this action"
                })
        }
    },
    canDelete:async(req,res,next)=>{
        const role=req.user.role;
        if(!(role==="labeler"||role==="admin")){
            return res.status(401).json({
                error:"You are not authorized to perform this action"
            })
            }
            else{
            next();
        }
    }

}
