
const authorize=(...allowedRoles)=>{
    return (req,res,next)=>{
        const userRole=req.user.role;
        if(!userRole){
            return res.status(401).json({error:"Unauthorized"});
        }
        if(!allowedRoles.includes(userRole)){
            return res.status(403).json({error:"Access denied"});
        }
        else{
            req.user.role=userRole;
            next();
        }

    }
};
export default authorize;