# Veralabel 🛡️

**Making AI work for humans, not against them.**

Veralabel is building the data foundation for trustworthy, human-centered AI. We provide infrastructure that treats data as a governed asset, ensuring transparency, responsible labeling, and alignment with human values.

## 🚀 Features

- **Authentication & Security**:
  - Secure Signup/Login with JWT (Access & Refresh Tokens).
  - HTTP-Only Cookies for secure token storage.
  - Role-Based Access Control (Admin, Labeler, Client).
- **User Management**:
  - Profile management with Trust Scores.
  - Moderation tools: Ban, Block, Suspend, Promote/Demote users.
- **Dataset Governance**:
  - Dataset submission and moderation workflow (Pending -> Approved/Rejected).
  - Flagging system for problematic datasets.
- **Analytics**:
  - System-wide overview of users, datasets, and revenue.
- **Architecture**:
  - Modular, scalable backend structure using Node.js and Express and FadtAPI for microservices and ensuring data integrity.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **MicroService**: FastAPI
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JSON Web Tokens (JWT), bcrypt
- **Validation**: Custom validation logic

## 📦 Getting Started

### Prerequisites

- Node.js (v14+ recommended)
- MongoDB (Local or Atlas)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/veralabel-backend.git
   cd veralabel-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory and add the following variables:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/veralabel
   JWT_SECRET=your_super_secret_access_key
   JWT_REFRESH_SECRET=your_super_secret_refresh_key
   NODE_ENV=development
   ```

4. **Run the server**
   ```bash
   # Development mode (using nodemon)
   npm run dev

   # Production mode
   npm start
   ```

## 📂 Project Structure

```
src/
├── config/         # Environment and DB configuration
├── middlewares/    # Auth, Authorization, and Block checks
├── modules/        # Feature-based modules
│   ├── admin/      # Admin controller, routes, service
│   ├── analytics/  # System analytics
│   ├── auth/       # Authentication logic
│   ├── datasets/   # Dataset models and logic
│   ├── payments/   # Payment integration
│   └── users/      # User management
├── app.js          # Express app setup
├── routes.js       # Central route aggregator
└── server.js       # Server entry point
```

## 🔭 Our Vision

### The Core Problem
AI failures rarely start at the model. They start at the data. Most training data today lacks clear provenance, is labeled without accountability, and ignores cultural context.

### Project Status
🚧 **Early development**

Current focus:
- Backend foundations
- Secure data handling
- Labeling workflow design
- Governance-first architecture decisions

### Philosophy
We are not building AI to replace humans. We are building systems that allow humans to shape how AI is built.