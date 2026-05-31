<div align="center">
  <img src="https://via.placeholder.com/150?text=RepoLens" alt="RepoLens Logo" width="120" height="120" />
  
  # 🔍 RepoLens
  
  **The ultimate Project Evolution Engine — tracking, scoring, and snapshotting GitHub projects.**
  
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

## 📸 Demo & Screenshots

> **Note to self:** Drop your screenshots and demo videos in the `frontend/public/assets` folder or host them online, then update the links below!

### 🖼️ Screenshots

| Dashboard View | Repository Analysis |
| :---: | :---: |
| <img src="https://via.placeholder.com/600x350?text=Dashboard+Screenshot" alt="Dashboard View" width="400"/> | <img src="https://via.placeholder.com/600x350?text=Analysis+Screenshot" alt="Repo Analysis View" width="400"/> |

### 🎥 Video Walkthrough

<div align="center">
  <a href="YOUR_YOUTUBE_OR_VIDEO_LINK_HERE">
    <img src="https://via.placeholder.com/800x450?text=Click+to+watch+the+Video+Walkthrough" alt="Video Walkthrough" />
  </a>
  <p><i>Click the image above to watch a full walkthrough of RepoLens in action!</i></p>
</div>

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
- Copy `.env.example` to `.env` and fill in your environment variables (MongoDB URI, Redis URI, OpenAI Key, Firebase Admin credentials, Qdrant URL, etc.)
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
- Copy `.env.example` to `.env` and insert your Firebase config and Backend API URLs.
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

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check out the [issues page](https://github.com/yourusername/RepoLens/issues).

---

<div align="center">
  Made with ❤️ by [Nisarg Vekariya]
</div>
