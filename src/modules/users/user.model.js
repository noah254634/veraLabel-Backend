import mongoose from "mongoose";
const userSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    profilePicture:{
        type:String,
        default:""
    },
    bio:{
        type:String,
        default:""
    },
    role:{
        type:String,
        enum:["Labeler","Client","admin"],
        default:"Labeler"
    
    },

       // Account status
    isVerified: {
      type: Boolean,
      default: false, // email / KYC later
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Trust & quality (VERY Veralabel-specific)
    trustScore: {
      type: Number,
      default: 0, // increases with good labels
    },

    // Auth / security
    lastLoginAt: {
      type: Date,
    },

    // Soft deletion 
    deletedAt: {
      type: Date,
      default: null,
    },
  },{
    timestamps:true
})
export default mongoose.model("UserVera",userSchema);