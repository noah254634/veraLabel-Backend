import mongoose from 'mongoose';

const labellerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserVera',
      required: true,
      unique: true
    },


    tier: {
      type: String,
      enum: ['Trainee', 'Bronze', 'Silver', 'Gold'],
      default: 'Trainee'
    },

    isOnboarded: {
      type: Boolean,
      default: false
    },

    profile: {
      gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        default: 'other'
      },
      dateOfBirth: Date,
      location: {
        country: String,
        region: String,
        city: String
      },
      languages: [String],
      timezone: String
    },

    expertise: {
      skills: [String],
      annotationTypes: [String],
      toolsUsed: [String],
      yearsOfExperience: Number,
      description: String
    },


    performance: {
      totalTasksAssigned: {
        type: Number,
        default: 0
      },
      totalTasksCompleted: {
        type: Number,
        default: 0
      },
      totalTasksRejected: {
        type: Number,
        default: 0
      },
      averageQualityScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      completionRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      reliabilityScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      approvalRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      }
    },


    earnings: {
      totalEarned: {
        type: Number,
        default: 0
      },
      currentBalance: {
        type: Number,
        default: 0
      },
      pendingPayment: {
        type: Number,
        default: 0
      },
      lastPayoutDate: Date,
      totalPayouts: {
        type: Number,
        default: 0
      }
    },


    currentAssignedTasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
      }
    ],

    completedTasksLog: [
      {
        taskId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Task'
        },
        completedAt: Date,
        qualityScore: Number,
        approvalStatus: {
          type: String,
          enum: ['approved', 'rejected', 'pending'],
          default: 'pending'
        }
      }
    ],


    training: {
      completedTiers: [String],
      currentTrainingTier: String,
      trainingProgress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      certifications: [
        {
          name: String,
          completedAt: Date,
          score: Number
        }
      ]
    },


    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'banned'],
      default: 'active'
    },

    activityMetrics: {
      lastActiveAt: Date,
      lastTaskSubmittedAt: Date,
      loginCount: {
        type: Number,
        default: 0
      },
      streakDays: {
        type: Number,
        default: 0
      }
    },


    reviews: [
      {
        reviewer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'UserVera'
        },
        score: {
          type: Number,
          min: 1,
          max: 5
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },


    preferences: {
      preferredTaskTypes: [String],
      maxConcurrentTasks: {
        type: Number,
        default: 5
      },
      autoAcceptQualifyingTasks: {
        type: Boolean,
        default: false
      },
      notificationPreferences: {
        emailNotifications: {
          type: Boolean,
          default: true
        },
        taskAssignments: {
          type: Boolean,
          default: true
        },
        paymentNotifications: {
          type: Boolean,
          default: true
        }
      }
    }
  },
  { timestamps: true }
);

labellerSchema.index({ userId: 1 });
labellerSchema.index({ tier: 1 });
labellerSchema.index({ status: 1 });
labellerSchema.index({ 'performance.averageQualityScore': -1 });
labellerSchema.index({ createdAt: -1 });

export default mongoose.model('Labeller', labellerSchema);
