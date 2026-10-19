# 🌍 TripoNext — Next-Gen AI Travel Companion & Community Platform

<p align="center">
  <img src="public/favicon.png" alt="TripoNext Logo" width="100" height="100" />
</p>

<p align="center">
  <b>Plan smarter, travel safer, and explore hidden gems with verified travel buddies.</b><br>
  Built with a modern glassmorphism dark-mode UI, Google Gemini AI intelligence, enterprise-grade Multi-Factor Authentication (MFA), and Firebase Cloud Firestore.
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-v18+-68a063?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" /></a>
  <a href="https://firebase.google.com/"><img src="https://img.shields.io/badge/Firebase-Firestore-ffca28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase Firestore" /></a>
  <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/AI-Gemini%203.8%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini AI" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Security-2FA%20%2F%20MFA%20TOTP-critical?style=for-the-badge&logo=auth0&logoColor=white" alt="2FA MFA" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PWA-Enabled-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA Ready" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License: MIT" /></a>
</p>

---

## 📖 Overview

**TripoNext** is an all-in-one travel planning, budgeting, and social networking platform designed for modern explorers. Whether you're curating a solo journey, discovering offbeat hidden spots, splitting expenses with companions, or finding verified travel buddies for group trips, TripoNext makes travel planning seamless, safe, and engaging.

### 🌟 Why TripoNext?
- 🧠 **AI-Powered Itineraries:** Curated day-by-day plans, realistic budget allocations, packing lists, and local culinary gems powered by **Google Gemini 3.8 Flash** with instant offline fallback.
- 🔐 **Bank-Grade MFA Security:** Complete 2-Factor Authentication with TOTP Authenticator apps (Google / Microsoft Authenticator), AES-256-GCM encryption at rest, hashed single-use recovery codes, and Email OTP fallback.
- 🗺️ **Interactive Trip Command Center:** Live interactive maps, real-time weather forecasting, budget breakdown, and multi-currency expense tracker.
- 👥 **Travel Buddy Network:** Post upcoming trips, review organizer profiles, send join requests, and chat in real-time.
- 🎫 **Full Travel Bookings Suite:** Search and book simulated stays (hotels), flights, cabs, and buses with instant Firestore confirmation and ticket management.
- 📱 **Progressive Web App (PWA):** Installable on mobile and desktop devices with offline caching and blazing fast response times.

---

## ✨ Key Features

### 1. 🤖 AI Travel Assistant & Itinerary Engine
- **Gemini 3.8 Flash Chatbot:** Ask destination questions, visa guidelines, packing suggestions, or safety tips in natural language.
- **Smart Itinerary Generator:** Generate rich, authentic day-by-day itineraries with morning/afternoon/evening schedules, insider local tips, and culinary spots (Goa, Manali, Jaipur, Bali, Paris, and custom global destinations).
- **Graceful Fallback Mode:** Operates smoothly even without an API key using the built-in deterministic heuristic engine.
- **Itinerary PDF Export:** Export your complete custom trip itinerary into clean, printable PDFs.

### 2. 🛡️ Enterprise Security & Multi-Factor Authentication (MFA)
- **Time-Based One-Time Passwords (TOTP):** Seamless setup via QR code scan in Google Authenticator, Microsoft Authenticator, or Authy (`otplib` + `qrcode`).
- **AES-256-GCM Encryption:** TOTP secrets are encrypted at rest with server-side encryption keys before saving to the database.
- **Single-Use Recovery Codes:** Generates 8 cryptographic backup codes (hashed with SHA-256) for emergency access.
- **Email OTP Verification:** Optional 6-digit one-time passcode delivered via SMTP (Mailgun/Nodemailer).
- **Challenge-Response Login:** Strict multi-step token challenges prevent unauthorized access to protected endpoints.
- **Brute-Force Protection:** Rate-limiting on verification attempts with comprehensive audit logging.

### 3. 📊 Trip Planning & Expense Management
- **Interactive Route Map:** Visual exploration with pinpoints for accommodations, viewpoints, and transit stops.
- **Dynamic Budget Calculator:** Real-time budget breakdown for accommodation, transport, food, activities, and emergency buffer.
- **Expense Tracker:** Log group expenses, categorize spends, and view expense distribution charts.
- **Packing Checklist:** Smart gear recommendations customized to destination weather and terrain.

### 4. 🤝 Community & Travel Buddies
- **Find Buddies:** Browse trips created by verified travelers, filter by destination and vibe, and submit join requests.
- **Real-Time Buddy Chat:** Direct communication between travel companions to coordinate logistics.
- **Community Feed & Stories:** Share travel stories, upload travel photos with like counts, and discover community recommendations.
- **User Reputation & Referrals:** Personalized travel profiles with referral codes (`TRIP-XXXX`) to earn credits.

### 5. 🏨 Travel Bookings Engine
- **Hotel Reservations:** Search properties with amenities, guest reviews, and filter by budget.
- **Flight Search:** Compare routes, departure times, baggage allowances, and cabin classes.
- **Ground Transit (Cabs & Buses):** Outstation cabs and AC sleeper buses booking simulation with instant booking IDs.
- **My Bookings Dashboard:** Manage, track, and cancel active tickets directly from your profile.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 (Glassmorphism & Neon Dark Theme), Vanilla JavaScript (ES6+), PWA (Service Workers, Web App Manifest), Leaflet Maps |
| **Backend** | Node.js, Express.js 5.x, CORS, Dotenv |
| **Database** | Google Firebase Cloud Firestore (with auto-detecting in-memory fallback cache) |
| **Artificial Intelligence** | Google Gemini API (`@google/genai`) using Gemini 3.8 Flash |
| **Authentication & Security** | JWT (`jsonwebtoken`), Bcrypt (`bcryptjs`), TOTP (`otplib`), QR Code (`qrcode`), AES-256-GCM Cryptography |
| **Export Engine** | Puppeteer (Headless Chrome PDF generation) |
| **Testing** | Node.js Assert Test Suite (`test_mfa.js`) covering 8 security categories |

---

## 📁 Project Structure

```text
travel-buddy/
├── .env.example                  # Environment configuration template
├── database.sqlite               # Local legacy cache database
├── firebase.js                   # Firebase Admin SDK & Cloud Firestore service layer
├── itineraryEngine.js            # Curated itinerary generator & heuristic fallback engine
├── mfaService.js                 # Multi-Factor Authentication (TOTP, AES-256-GCM, Recovery Codes)
├── package.json                  # Project metadata, scripts, and dependencies
├── server.js                     # Main Express server and REST API routes
├── serviceAccountKey.example.json# Firebase service account credential template
├── start-app.bat                 # One-click Windows startup batch script
├── test_mfa.js                   # Automated 8-category MFA security test suite
├── vercel.json                   # Cloud deployment routing configuration
│
└── public/                       # Progressive Web App (PWA) client-side assets
    ├── index.html                # Main Dashboard, Interactive Map & Budget Planner
    ├── explore.html              # Destinations & Hidden Gems Explorer
    ├── mytrips.html              # My Trips, Expense Tracker, Packing List & Itinerary
    ├── buddies.html              # Travel Buddy Finder, Group Trips & Real-time Chat
    ├── community.html            # Community Feed, Photo Sharing, Stories & AI Support
    ├── login.html                # Login, Registration & MFA Setup / Verification
    ├── script.js                 # Core application controller & frontend interactions
    ├── auth.js                   # Client-side session and MFA challenge handler
    ├── style.css                 # Glassmorphism dark-mode UI stylesheet
    ├── service-worker.js         # Offline caching & background sync
    ├── manifest.json             # Web App Manifest for PWA installation
    └── assets/ / icons/          # Logos, icons, and visual assets
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v16.x or v18+ recommended)
- `npm` (bundled with Node.js)
- *(Optional)* [Google Gemini API Key](https://aistudio.google.com/) for live AI features
- *(Optional)* [Firebase Project Service Account](https://console.firebase.google.com/) for Cloud Firestore

---

### Step-by-Step Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/kavichauhan2007-sketch/TripoNext.git
cd TripoNext
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Open `.env` and fill in your configuration:
```env
# Server Port
PORT=3001

# Primary JWT Secret
SECRET_KEY=your_super_secret_jwt_key_here

# Dedicated Server-Side Key for AES-256-GCM MFA Encryption
MFA_ENCRYPTION_KEY=your_32_character_mfa_encryption_key_here

# (Optional) Google Gemini AI API Key
GEMINI_API_KEY=your_gemini_api_key_here

# (Optional) Firebase Cloud Firestore Database Configuration
# Method A: Place downloaded serviceAccountKey.json in the project root.
# Method B: Or specify environment variables:
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# (Optional) SMTP Email configuration for Email OTP verification
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=your_smtp_password
SMTP_FROM=security@triponext.com
```

> **Note:** If Firebase credentials are not provided, TripoNext automatically uses its built-in in-memory fallback store so you can develop and test immediately without blocking setup!

---

### 4. Running the Application

#### Standard Startup:
```bash
npm start
```
*or:*
```bash
node server.js
```

#### Windows One-Click Launch:
Double-click `start-app.bat` or run:
```bat
start-app.bat
```

Once started, open your browser and navigate to:
👉 **`http://localhost:3001`**

---

### 5. Running Security & MFA Test Suite

To verify authentication, token guards, TOTP setup, replay protection, and recovery codes:
```bash
npm test
```
This runs `test_mfa.js` verifying all 8 core security suites:
- `[PASS]` Existing login, signup, guest auth, and logout regressions
- `[PASS]` Protected endpoint access rejection with challenge tokens
- `[PASS]` MFA enrollment initiation, password re-auth & QR generation
- `[PASS]` Valid and invalid authenticator codes during login
- `[PASS]` Expired and replayed TOTP codes prevention
- `[PASS]` One-time recovery code use and single-use reuse prevention
- `[PASS]` Rate limiting, brute-force protection, and attempt limits
- `[PASS]` Recovery codes regeneration and MFA disablement flow

---

## 📡 REST API Reference

### 🔐 Authentication & MFA
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/register` | Register a new user account | No |
| `POST` | `/api/login` | Login user (returns JWT or MFA challenge) | No |
| `GET` | `/api/auth/mfa/status` | Get current user's 2FA status | Yes (Bearer Token) |
| `POST` | `/api/auth/mfa/enroll` | Request TOTP secret & QR code with password verification | Yes (Bearer Token) |
| `POST` | `/api/auth/mfa/confirm` | Confirm TOTP code and activate MFA | Yes (Bearer Token) |
| `POST` | `/api/auth/mfa/verify` | Submit TOTP / Email OTP / Recovery code for login challenge | Yes (Challenge Token) |
| `POST` | `/api/auth/mfa/disable` | Disable 2FA with current password & TOTP verification | Yes (Bearer Token) |
| `POST` | `/api/auth/mfa/recovery-codes` | Regenerate single-use backup recovery codes | Yes (Bearer Token) |
| `POST` | `/api/auth/mfa/email-otp/send` | Send 6-digit OTP to user's registered email | Yes (Challenge Token) |

### ✈️ Trips & Itineraries
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/trips` | Get current user's saved trips | Yes |
| `POST` | `/api/trips` | Create a new trip itinerary | Yes |
| `PUT` | `/api/trips/:id` | Update an existing trip | Yes |
| `DELETE` | `/api/trips/:id` | Delete a trip | Yes |
| `POST` | `/api/ai-itinerary` | Generate AI day-by-day plan with budget & tips | No / Optional |
| `GET` | `/api/trips/:id/expenses` | Retrieve trip expenses and budget tally | Yes |
| `POST` | `/api/trips/:id/expenses` | Add a categorized expense item | Yes |
| `DELETE` | `/api/trips/:id/expenses/:expId` | Delete a recorded expense item | Yes |

### 🤖 AI Assistant & Support
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/ai-chat` | Chat with Gemini 3.8 Flash Travel Assistant | No |
| `GET` | `/api/support/faqs` | Fetch curated travel & app support FAQs | No |
| `POST` | `/api/support/ticket` | Submit a customer support assistance ticket | No / Optional |
| `POST` | `/api/feedback` | Submit user feedback and ratings | No / Optional |

### 👥 Travel Buddies & Social Feed
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/posts` | Fetch community feed posts and travel stories | No |
| `POST` | `/api/posts` | Publish a community post | Yes |
| `GET` | `/api/messages` | Retrieve buddy chat history | Yes |
| `POST` | `/api/messages` | Send a real-time message to a buddy | Yes |
| `GET` | `/api/photos` | Browse community travel photo stream | No |
| `POST` | `/api/photos` | Upload a travel photo with caption | Yes |
| `POST` | `/api/photos/:id/like` | Like/unlike a community photo | Yes |
| `GET` | `/api/hidden-gems` | Discover user-contributed offbeat destinations | No |
| `POST` | `/api/hidden-gems` | Submit a new hidden gem recommendation | Yes |

### 🎫 Bookings Engine
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/bookings/hotels` | Search hotels by city, check-in, check-out | No |
| `GET` | `/api/bookings/flights` | Search one-way or round-trip flights | No |
| `GET` | `/api/bookings/cabs` | Search local & outstation cabs | No |
| `GET` | `/api/bookings/buses` | Search intercity buses & sleeper coaches | No |
| `POST` | `/api/bookings/create` | Confirm booking & record Firestore transaction | Yes |
| `GET` | `/api/bookings/my-bookings` | List all confirmed bookings for active user | Yes |
| `DELETE` | `/api/bookings/:id` | Cancel an active booking reservation | Yes |

---

## 🔒 Security Architecture Highlights

```text
[User Login] ──> Valid Credentials?
                     │
         ┌───────────┴───────────┐
      MFA Enabled?             MFA Disabled?
         │                           │
  [Issue Challenge Token]      [Issue Full JWT]
  (Restricted Scope, 5 min)
         │
  [Submit TOTP / Email OTP / Recovery Code]
         │
  Verify code + Decrypt secret (AES-256-GCM)
         │
  [Issue Full Access JWT] ──> Access Protected APIs
```

1. **Defense-in-Depth:** Protected APIs reject temporary MFA challenge tokens outright (`purpose: 'mfa_challenge'`), preventing 2FA bypass.
2. **Encrypted at Rest:** Secrets are never stored in plaintext; AES-256-GCM ensures confidentiality even if database access is compromised.
3. **Replay & Clock-Drift Prevention:** Strict single-token consumption tracking and time-window validation.
4. **Comprehensive Audit Logs:** All MFA events (`MFA_ENROLL_CONFIRMED`, `MFA_VERIFY_SUCCESS`, `MFA_RECOVERY_CODE_USED`, `MFA_DISABLED`) are recorded with timestamps, user IDs, and client IP addresses.

---

## 🤝 Contributing

Contributions are what make the open-source community an incredible place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<p align="center">
  Crafted with ❤️ by the <b>TripoNext Team</b><br>
  <i>Empowering travelers worldwide with intelligent technology.</i>
</p>
