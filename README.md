# SSB Psychological Assessment & Evaluation Platform

A state-of-the-art, high-fidelity timed psychological testing and assessment platform designed specifically for Services Selection Board (SSB) candidate preparation. This system provides a realistic, timed environment for psychological batteries (WAT, TAT, SRT, and SD) combined with a premium administration and evaluation suite.

## 🚀 Key Features

### 👨‍🎓 Timed Candidate Engine (Student Dashboard)
* **Real-time Assessment Player**: Simulates real SSB examination conditions with precise timers and transitions.
* **Psychological Batteries Supported**:
  * **TAT (Thematic Apperception Test)**: Timed slide presentations with complex imagery.
  * **WAT (Word Association Test)**: Rapid-fire word prompts (15 seconds per word).
  * **SRT (Situation Reaction Test)**: Diverse situational challenges requiring quick judgment.
  * **SD (Self Description)**: Guided self-evaluation categories.
* **Premium User Controls**:
  * Seamless responsive layouts adapting to both landscape (default) and mobile portrait viewports.
  * Adaptive typography rendered in the brand's elegant **Kelson** typeface.
  * Live **Font Size Slider** in the bottom presenter bar for real-time text scaling.
  * Glassmorphic visual theme with golden accents (`#D2A100`) and smooth micro-animations.

### 👩‍💼 Assessor & Creator Suite (Admin Portal)
* **Assessment Creator**: Intuitive interface for creating, modifying, and ordering batteries and slides.
* **Response Evaluation Workflow**: Specialized dashboard for assessors to review candidate submissions, analyze timing, and grade responses.
* **Admin Dashboard**: System telemetry, candidate metrics, and active session management.

---

## 🛠️ Tech Stack

* **Frontend**: React, Vite, TypeScript, Tailwind CSS v4, HTML5 (Semantic Structure)
* **Backend & API**: Node.js, Express, MongoDB (Mongoose), JSON Web Tokens (JWT) for secure authentication
* **API Integration**: Integrated with the Gemini API for advanced semantic assessment analytics and response evaluation support.

---

## ⚙️ Setup and Installation

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **MongoDB** (local or Atlas cluster)

### Local Configuration
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Nikhilkrchandrakala/psych_battery.git
   cd psych_battery
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory and define the following:
   ```env
   # API Keys & Ports
   GEMINI_API_KEY="your_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   
   # Database & Auth
   MONGODB_URI="your_mongodb_connection_string_here"
   JWT_SECRET="your_secure_jwt_secret_here"
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   The application will be accessible at the URL printed in your terminal (typically `http://localhost:5173` or `http://localhost:3000`).

---

## 🏗️ Production Build and Deployment

To build the production-ready bundle:
```bash
npm run build
```

The production code will be compiled into the `dist` directory. The integrated Node.js/TypeScript production server can be launched using:
```bash
npm run start
```
