export const checkisBlocked=async(req,res,next)=>{
    const user=req.user;
    if(user?.isBlocked){
        const reason=user.isBlocked.reason;
        return res.status(403).json({error:"User is blocked,reason being:"+reason});
    }
    next();

}