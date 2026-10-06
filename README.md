# 🌍 TripoNext

TripoNext is a modern, community-driven travel planning platform that helps you craft your dream itinerary, calculate budgets, and discover verified travel buddies. 

Built with a stunning glassmorphism UI, a focus on "Hidden Gems," and powerful AI-assisted tools to make your journey seamless from inspiration to execution!

## ✨ Key Features

- **Dashboard**: Live interactive map, weather checks, and an automated trip budget calculator.
- **Explore**: Discover popular countries and unique "Hidden Gems" with AI-scored recommendations (uniqueness, crowd levels, and vibe).
- **My Trips**: Manage and track your personal travel itineraries.
- **Community & Support**: 
  - Read reviews and share travel experiences.
  - Dedicated App Feedback system to suggest features or report bugs.
  - **TripoNext Support AI**: A smart fallback AI chatbot to guide you through the app.
- **Find Buddies**: Post a trip, browse upcoming trips hosted by verified organizers, and send join requests.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Glassmorphism & Dark Theme)
- **Backend**: Node.js, Express.js
- **Database**: SQLite (User profiles, trips, hidden gems, and community posts)
- **Authentication**: JWT & Bcrypt (Secure Login/Register)
- **AI Integration**: Google Gemini API (@google/genai) with a smart fallback rule-engine.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm (Node Package Manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kavichauhan2007-sketch/TripoNext.git
   cd TripoNext
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **(Optional) Configure AI Features**
   To enable true intelligent AI responses, create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *Note: If no key is provided, the TripoNext Support Bot will use a built-in smart fallback system without any errors.*

4. **Run the Application**
   ```bash
   node server.js
   ```

5. **Open in Browser**
   Navigate to `http://localhost:3001` to start exploring!

## 📸 Screenshots

*(Add screenshots of your beautiful dark-themed UI here)*

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/kavichauhan2007-sketch/TripoNext/issues).

## 📜 License

This project is licensed under the MIT License.
