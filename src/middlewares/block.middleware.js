export const checkisBlocked=async(req,res,next)=>{
    const user=req.user;
    const state=user?.isBlocked?.status;
    if(state){
        // Don't expose internal reasons - send generic message
        return res.status(403).json({error:"Access denied. Please contact support."});
    }
    next();

}