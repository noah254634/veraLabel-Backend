import { all } from "axios";

const authorize=(...allowedRoles)=>{

    return (req,res,next)=>{
        try{
        const userRole=req.user.role;
        if(!userRole){
            return res.status(401).json({error:"Unauthorized"});
        }
        if(!allowedRoles.includes(userRole)){
            return res.status(403).json({error:`Access denied only ${allowedRoles.join(",")} is(are) allowed to perform this action`});
        }
        else{
            req.user.role=userRole;
            next();
        }
        }catch(err){
            return res.status(401).json({error:err.message});
        }

    }

};
export default authorize;