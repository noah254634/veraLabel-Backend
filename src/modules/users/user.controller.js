import UserVera from "./user.model.js";
import { validateSignupDto,validateLoginDto } from "./user.dto.js";
import { createUser,loginUser } from "./user.service.js";
import { generateAccessToken,generateRefreshToken,setAuthCookies,clearAuthCookies } from "./user.auth.js";

export const signUpcontroller = async (req, res) => {
  try {
    const dto = validateSignupDto(req.body);
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
export const getUserController = async (req, res) => {
    const users=await UserVera.find();
    return res.status(200).json({
        users
    })

};
export const loginController = async (req, res) => {
    try {
    const dto = validateLoginDto(req.body);
    const user=await loginUser(dto);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);
    return res.status(200).json({
        message: "User logged in successfully",
        user,
      });
    
    }
    
    catch(err){
        return res.status(400).json({ error: err.message });
    }

};
export const logoutController = async (req, res) => {
    clearAuthCookies(res);
    return res.status(200).json({
      message: "User logged out successfully",
    });
};