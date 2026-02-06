import { validateSignup } from "./auth.validation.js";
import { validateLogin } from "./auth.validation.js";
import { createUser,loginUser } from "./auth.service.js";
import { generateAccessToken,generateRefreshToken,setAuthCookies,clearAuthCookies } from "./auth.cookie.js";
export const signUpcontroller = async (req, res) => {
  try {
    console.log(req.body);
    const dto = validateSignup(req.body);
    console.log(dto);
    const user = await createUser(dto);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);
    return res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
export const loginController = async (req, res) => {
    try{
        console.log(req.body);
        const valideRes=validateLogin(req.body);
        const user=await loginUser(valideRes);
        const accessToken=generateAccessToken(user);
        const refreshToken=generateRefreshToken(user);
        setAuthCookies(res,accessToken,refreshToken);
        return res.status(200).json({
            message:"User logged in successfully",
            user
        })
    }catch(err){
        return res.status(400).json({error:err.message});
    }
}
  

export const logoutController=(req,res)=>{
    clearAuthCookies(res);
    return res.status(200).json({
        message:"User logged out successfully"
    })

}
export const verifyEmailController=(req,res)=>{

}
export const forgotPasswordController=(req,res)=>{

}
export const resetPasswordController=(req,res)=>{

}
