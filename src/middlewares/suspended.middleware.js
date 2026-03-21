export const checkIsSuspended=async(req,res,next)=>{
    const status=req.user?.isSuspended.status
    if(status===true){
        throw new Error(`your account is suspended for  ${isSuspended.reason}`)
    }
    next()

}