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
    balance:{
        type:Number,
        default:0
    },
    password:{
        type:String,
        select:false,
        required:true
    },
    profilePicture:{
        type:String,
        default:""
    },
    isBlocked:{
      status:{
        type:Boolean,
        default:false
      },
      reason:{
        type:String,
        default:""
      }
    },
    isBanned:{
      status:{
        type:Boolean,
        default:false
      },
      reason:{
        type:String,
        default:""
      }
    },

    role:{
        type:String,
        enum:["labeler","buyer","admin","superadmin","reviewer"],
        default:"labeler",
        lowercase:true,
        trim:true
    
    },

    isSuspended:{
      status:{
        type:Boolean,
        default:false
      },
      reason:{
        type:String,
        default:""
      }
    },
 

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },


    trustScore: {
      type: Number,
      default: 0,
    },


    lastLoginAt: {
      type: Date,
    },


    deletedAt: {
      type: Date,
      default: null,
    },
    userLocation:{
        country:{
            type:String,
            default:""
        },
        city:{
            type:String,
            default:""
        },
        state:{
            type:String,
            default:""
        },
        locationUpdatedAt:{
            type:Date,
            default:Date.now
        }
    },

    fcmToken: {
      type: String,
      default: null,
    },
    passwordResetAttempts: {
      type: Number,
      default: 0,
    },
    lastPasswordResetAttemptAt: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpire: {
      type: Date,
      default: null,
    },
  },{
    timestamps:true
  })
export default mongoose.model("UserVera",userSchema);
