import { UserService } from "./user.service.js";

export const UserController = {
  getUsersByCity: async (req, res) => {
    try {
        const {city}=req.body;
        const users = await UserService.getUserByCity(city);
        return res.json(users);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
  },
  getUserById: async (req, res) => {
    try{
        const user=await UserService.getUserById(req.params.id);
        return res.json(user);
    }catch(err){
        return res.status(400).json({message:err.message});
    }
  },
  updateUser: async (req, res) => {
    try{
        const user=await UserService.updateUser(req.params.id,req.body);
        return res.json(user);
    }catch(err){}
  },
  suspendUser: async (req, res) => {
    const {id}=req.params;
    const {reason}=req.body;
    const user=await UserService.suspendUserById(id,reason);
    return res.json(user);
  },
  deleteUser: async (req, res) => {
    const {id}=req.params;
    const user=await UserService.deleteUserById(id);
    return res.json(user);
  },
  getAllUsers: async (req, res) => {
    const users=await UserService.getAllUsers();
    return res.json(users);
  },
  getUsersByRole: async (req, res) => {
    const users=await UserService.getUserByRole(req.query.role);
    return res.json(users);
  },
  getUsersByStatus: async (req, res) => {
    const users=await UserService.getUserByStatus(req.query.status);
    return res.json(users);
  },
  getUsersByTrustScore: async (req, res) => {
    const {score}=req.body;
    const users=await UserService.getUserByTrustScore(score);
    return res.json(users);
  },
  suspendUser: async (req, res) => {
    const {id}=req.params;
    const {reason}=req.body;
    const user=await UserService.suspendUserById(id,reason);
    return res.json(user);
  },
  unsuspendUser: async (req, res) => {
    const {id}=req.params;
    const user=await UserService.unsuspendUserById(id);
    return res.json(user);
  },
  deleteUser: async (req, res) => {},
  getUserByEmail: async (req, res) => {},
  
  blockUser: async (req, res) => {
    const {id}=req.params;
    const {reason}=req.body;
    const user=await UserService.blockUserById(id,reason);
    return res.json(user);
  },
  unblockUserById: async (req, res) => {
    const {id}=req.params;
    const user=await UserService.unblockUserById(id);   
  },

};

