<div align="center">
  <img src="frontend/public/repolens-logo.png" alt="RepoLens Logo" width="120" height="120" />
  
  # 🔍 RepoLens
  
  **The ultimate Project Evolution Engine — tracking, scoring, and snapshotting GitHub projects.**
  
  🌐 **Live Site:** [https://repolens07.vercel.app/](https://repolens07.vercel.app/)
  
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  
  [Features](#features) •
  [Tech Stack](#tech-stack) •
  [Demo](#demo--screenshots) •
  [Installation](#installation) •
  [Usage](#usage)

</div>

---

## 📖 Overview

**RepoLens** is a powerful application designed to analyze, score, and track the evolution of GitHub repositories over time. Whether you're assessing project health, monitoring contributor activity, or leveraging AI to understand code structure, RepoLens provides deep, real-time insights with a beautiful, responsive user interface.

---

## ✨ Features

- 📊 **Repository Scoring:** Evaluates project health and structure with advanced metrics.
- 🕒 **Project Snapshots:** Tracks changes over time for historical analysis.
- 🤖 **AI-Powered Insights:** Uses OpenAI and onnxruntime for code analysis and embeddings.
- ⚡ **Real-Time Updates:** Powered by Socket.io to keep clients perfectly in sync.
- 🎨 **Beautiful UI:** Crafted with React, Tailwind CSS, Framer Motion for smooth animations, and Recharts for data visualization.
- 🔐 **Secure & Robust:** Employs Firebase Auth, Redis + BullMQ for background jobs, and robust security middleware.

---

## 💻 Tech Stack

### Frontend

- **Framework:** React + Vite
- **Styling:** Tailwind CSS, Framer Motion
- **Data Visualization:** Recharts
- **Communication:** Axios, Socket.io-client
- **Auth:** Firebase

### Backend

- **Core:** Node.js, Express
- **Database:** MongoDB
- **Queue/Cache:** Redis, BullMQ
- **Vector DB:** Qdrant (for AI embeddings)
- **AI/ML:** OpenAI, `@xenova/transformers`, `onnxruntime-node`
- **Real-time:** Socket.io
- **Security:** Helmet, Express-Rate-Limit, Express-Mongo-Sanitize, XSS-Clean

---

## 📂 Project Structure

```text
RepoLens/
├── backend/            # Express API, MongoDB models, background workers
│   ├── src/controllers/
│   ├── src/services/
│   └── src/workers/    # BullMQ job processors for AI & syncing
├── frontend/           # React + Vite application
│   ├── src/components/ # Reusable UI components
│   ├── src/pages/      # Dashboard, Authentication, and Views
│   └── src/api/        # Axios API clients
└── README.md
```

---

## ⚙️ Architecture & Pipeline Workflow

RepoLens utilizes a robust, dual-stage asynchronous pipeline powered by **BullMQ** and **Redis** to ensure scalable and reliable processing of GitHub repositories.

### 1. Project Sync Pipeline (`projectSync.worker`)

When a repository is added or refreshed, the Project Sync worker is triggered:

- **Data Ingestion**: Fetches metadata, commit history, issues, PRs, and contributor stats via the GitHub API (or local path bypass).
- **Health Scoring**: Calculates a repository "health score" based on activity and engagement metrics.
- **Snapshot Creation**: Stores a historical snapshot of the repository state in MongoDB.
- **Alerts & Recommendations**: Generates actionable insights and triggers any configured alerts.
- **Trigger**: Automatically queues the AI Analysis job upon completion.

### 2. AI Analysis & Embedding Pipeline (`aiAnalysis.worker`)

The AI worker performs deep-dive code intelligence using a Retrieval-Augmented Generation (RAG) architecture:

- **Repository Cloning**: Clones the repository locally (depth=1).
- **Repomix Parsing**: Runs Repomix to intelligently parse, chunk, and extract the codebase structure into prioritized files.
- **Vector Embedding**: Embeds the code chunks into **Qdrant** (Vector DB) for lightning-fast semantic search.
- **RAG + LLM Generation**: Uses focused queries against Qdrant to pull relevant context, feeding it to **Gemini/OpenAI** to generate a comprehensive code quality and tech trend report.
- **Real-Time Delivery**: Streams live progress updates back to the frontend via **Socket.io**.

### 🔄 Pipeline Diagram

```mermaid
graph TD
    Client[Frontend Client] -->|Add Repo / OAuth| API[Express API]
    API -->|Queue Job| RedisQueue[(Redis + BullMQ)]

    subgraph Stage 1: Project Sync
        RedisQueue -->|Pop| SyncWorker[Project Sync Worker]
        SyncWorker -->|Fetch Stats| GitHubAPI[GitHub API]
        SyncWorker -->|Calculate Score| ScoringService[Scoring Service]
        SyncWorker -->|Save Snapshot| MongoDB[(MongoDB)]
        SyncWorker -->|Queue AI Job| RedisQueue
    end

    subgraph Stage 2: AI Analysis
        RedisQueue -->|Pop| AIWorker[AI Analysis Worker]
        AIWorker -->|Clone| LocalRepo[Local Git Repo]
        LocalRepo -->|Parse Codebase| Repomix[Repomix Service]
        Repomix -->|Chunk & Embed| Qdrant[(Qdrant Vector DB)]
        Qdrant -->|Retrieve Context| RAGService[RAG Query Service]
        RAGService -->|Generate Report| LLM[Gemini / OpenAI]
        LLM -->|Save Report| MongoDB
    end

    SyncWorker -.->|Live Updates| SocketIO[Socket.io]
    AIWorker -.->|Live Updates| SocketIO
    SocketIO -.->|Progress| Client
```

---

## 📸 Demo & Screenshots

### Home & Authentication
| Home Page | Login Page |
| :---: | :---: |
| <img src="frontend/public/assets/i1.png" alt="Home Page" width="400"/> | <img src="frontend/public/assets/i2.png" alt="Login Page" width="400"/> |

| Login with Google | Authenticate by Code |
| :---: | :---: |
| <img src="frontend/public/assets/i3.png" alt="Login with Google" width="400"/> | <img src="frontend/public/assets/i12.png" alt="Authenticate by Code" width="400"/> |

### Dashboard & Setup
| Empty Dashboard | Add by URL |
| :---: | :---: |
| <img src="frontend/public/assets/i4.png" alt="Empty Dashboard" width="400"/> | <img src="frontend/public/assets/i5.png" alt="Add by URL" width="400"/> |

| Connect GitHub (Private Repos) | Dashboard with Repository |
| :---: | :---: |
| <img src="frontend/public/assets/i11.png" alt="Connect GitHub" width="400"/> | <img src="frontend/public/assets/i9.png" alt="Dashboard with one repo" width="400"/> |

### Repository Analysis & Settings
| Initial Setup / Sync | Loading Analysis |
| :---: | :---: |
| <img src="frontend/public/assets/i6.png" alt="Initial Setup" width="400"/> | <img src="frontend/public/assets/i7.png" alt="Loading Analysis" width="400"/> |

| Project Overview & Data | Settings Page |
| :---: | :---: |
| <img src="frontend/public/assets/i8.png" alt="Overview page with data" width="400"/> | <img src="frontend/public/assets/i10.png" alt="Settings Page" width="400"/> |

---

## 🚀 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [MongoDB](https://www.mongodb.com/)
- [Redis](https://redis.io/)
- [Qdrant](https://qdrant.tech/)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/RepoLens.git
cd RepoLens
```

### 2. Backend Setup

```bash
cd backend
npm install
```

- Copy `.env.example` to `.env` and fill in your environment variables:
  - **Database & Cache**: `MONGO_URL`, `DB_NAME`, `REDIS_URL`
  - **Auth**: `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`
  - **Firebase Admin**: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - **GitHub OAuth**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`
  - **AI / LLM**: `GROQ_API_KEY`, `OPENAI_BASE_URL`, `LLM_MODEL`
  - **Vector DB**: `QDRANT_URL`, `QDRANT_API_KEY`
- Initialize the Database:

```bash
npm run db:init
```

- Start the development server:

```bash
npm run dev
```

### 3. Frontend Setup

Open a new terminal window:

```bash
cd frontend
npm install
```

- Copy `.env.example` to `.env` and fill in your environment variables:
  - `VITE_API_URL` (e.g., http://localhost:5000)
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
- Start the Vite development server:

```bash
npm run dev
```

---

## 🕹️ Usage

1. Open your browser and navigate to `http://localhost:5173` (or the port Vite provides).
2. Login / Register using the Firebase authentication portal.
3. Add a GitHub repository link to begin tracking and scoring.
4. View real-time background processing updates powered by BullMQ and Socket.io.
5. Explore the analytics dashboard and review project snapshots!

---

<div align="center">
  Made with 💖 by <a href="https://github.com/nisargvekariya01">Nisarg Vekariya</a>
</div>
