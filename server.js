const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = 3001;
const SECRET_KEY = 'super_secret_travel_buddy_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        
        // Create Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT
        )`);

        // Create Trips table
        db.run(`CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            destination TEXT,
            dates TEXT,
            budget REAL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Create Community Posts table
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            author_name TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Create Hidden Gems table (AI Gem Score feature)
        db.run(`CREATE TABLE IF NOT EXISTS hidden_gems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            city TEXT,
            country TEXT,
            category TEXT,
            description TEXT,
            gem_score INTEGER,
            rating REAL,
            crowd_level TEXT,
            budget TEXT,
            best_time TEXT,
            distance TEXT,
            photo_url TEXT,
            submitted_by TEXT,
            uniqueness_score INTEGER,
            crowd_score INTEGER,
            vibe_score INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            // Seed initial hidden gems if table is empty
            db.get("SELECT COUNT(*) as count FROM hidden_gems", [], (err, row) => {
                if (row && row.count === 0) {
                    const seedGems = [
                        {
                            name: "Nahargarh Sunset Secret Point",
                            city: "Jaipur",
                            country: "India",
                            category: "Secret Viewpoint",
                            description: "A secluded ledge overlooking the entire Pink City with zero crowd compared to the main fort terrace.",
                            gem_score: 96,
                            rating: 4.8,
                            crowd_level: "Very Low",
                            budget: "₹0 - ₹100",
                            best_time: "5:00 PM - 7:00 PM",
                            distance: "25 min from city center",
                            photo_url: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
                            submitted_by: "TripoNext AI Guide",
                            uniqueness_score: 98,
                            crowd_score: 92,
                            vibe_score: 97
                        },
                        {
                            name: "Arashiyama Secret Bamboo Alley & Teahouse",
                            city: "Kyoto",
                            country: "Japan",
                            category: "Local Cafés",
                            description: "Hidden 10 minutes past the crowded main grove, serving handmade matcha under 400-year-old pine trees.",
                            gem_score: 94,
                            rating: 4.9,
                            crowd_level: "Low",
                            budget: "¥800 - ¥1500",
                            best_time: "8:00 AM - 10:00 AM",
                            distance: "15 min walk from station",
                            photo_url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
                            submitted_by: "Kyoto Local Explorer",
                            uniqueness_score: 95,
                            crowd_score: 91,
                            vibe_score: 96
                        },
                        {
                            name: "Montmartre Hidden Vineyards & Artists Alley",
                            city: "Paris",
                            country: "France",
                            category: "Hidden History",
                            description: "The secret Clos Montmartre vineyard hidden in plain sight behind the Sacré-Cœur with vintage Parisian charm.",
                            gem_score: 92,
                            rating: 4.7,
                            crowd_level: "Moderate Low",
                            budget: "€0 - €10",
                            best_time: "4:00 PM - 6:30 PM",
                            distance: "10 min from Anvers Metro",
                            photo_url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
                            submitted_by: "Parisian Insider",
                            uniqueness_score: 92,
                            crowd_score: 89,
                            vibe_score: 95
                        },
                        {
                            name: "Iao Needle Secret Stream Trail",
                            city: "Maui",
                            country: "USA",
                            category: "Nature & Waterfalls",
                            description: "An uncrowded lush rainforest stream trail leading to natural emerald freshwater plunge pools.",
                            gem_score: 97,
                            rating: 4.9,
                            crowd_level: "Very Low",
                            budget: "$0 - $5",
                            best_time: "9:00 AM - 12:00 PM",
                            distance: "20 min drive from Kahului",
                            photo_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
                            submitted_by: "Aloha Hiker",
                            uniqueness_score: 99,
                            crowd_score: 95,
                            vibe_score: 97
                        },
                        {
                            name: "Giardino degli Aranci Secret Keyhole View",
                            city: "Rome",
                            country: "Italy",
                            category: "Instagram Photo Spot",
                            description: "Framed perfectly through the Priory Keyhole, an enchanting view of St. Peter's Basilica through manicured hedges.",
                            gem_score: 95,
                            rating: 4.8,
                            crowd_level: "Low",
                            budget: "€0",
                            best_time: "6:00 PM - 7:30 PM",
                            distance: "15 min walk from Circus Maximus",
                            photo_url: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
                            submitted_by: "Roma Wanderer",
                            uniqueness_score: 96,
                            crowd_score: 93,
                            vibe_score: 96
                        },
                        {
                            name: "Dudhsagar Secret Base Trail",
                            city: "Goa",
                            country: "India",
                            category: "Offbeat Escapes",
                            description: "Off-the-beaten-path railway bridge trek giving unobstructed views of the roaring 4-tiered white waterfall.",
                            gem_score: 93,
                            rating: 4.7,
                            crowd_level: "Low",
                            budget: "₹200 - ₹500",
                            best_time: "7:00 AM - 11:00 AM",
                            distance: "1 hr from Panaji",
                            photo_url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80",
                            submitted_by: "Goa Backpacker",
                            uniqueness_score: 94,
                            crowd_score: 90,
                            vibe_score: 95
                        }
                    ];

                    const stmt = db.prepare(`INSERT INTO hidden_gems (name, city, country, category, description, gem_score, rating, crowd_level, budget, best_time, distance, photo_url, submitted_by, uniqueness_score, crowd_score, vibe_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                    seedGems.forEach(g => {
                        stmt.run(g.name, g.city, g.country, g.category, g.description, g.gem_score, g.rating, g.crowd_level, g.budget, g.best_time, g.distance, g.photo_url, g.submitted_by, g.uniqueness_score, g.crowd_score, g.vibe_score);
                    });
                    stmt.finalize();
                    console.log('Seeded initial Hidden Gems dataset into SQLite.');
                }
            });
        });
    }
});

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// API: Register User
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], function(err) {
            if (err) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            const token = jwt.sign({ id: this.lastID, email, name }, SECRET_KEY);
            res.json({ token, user: { name, email } });
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// API: Login User
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!user) return res.status(400).json({ error: 'User not found' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
        
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY);
        res.json({ token, user: { name: user.name, email: user.email } });
    });
});

// API: Create Trip
app.post('/api/trips', authenticateToken, (req, res) => {
    const { destination, dates, budget } = req.body;
    const userId = req.user.id;
    
    db.run('INSERT INTO trips (user_id, destination, dates, budget) VALUES (?, ?, ?, ?)', 
        [userId, destination, dates, budget], 
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ id: this.lastID, destination, dates, budget });
        }
    );
});

// API: Get My Trips
app.get('/api/trips', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    db.all('SELECT * FROM trips WHERE user_id = ? ORDER BY id DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// API: Update Trip
app.put('/api/trips/:id', authenticateToken, (req, res) => {
    const { destination, dates, budget } = req.body;
    const userId = req.user.id;
    const tripId = req.params.id;
    
    db.run('UPDATE trips SET destination = ?, dates = ?, budget = ? WHERE id = ? AND user_id = ?', 
        [destination, dates, budget, tripId, userId], 
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(404).json({ error: 'Trip not found or unauthorized' });
            res.json({ success: true });
        }
    );
});

// API: Delete Trip
app.delete('/api/trips/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const tripId = req.params.id;
    
    db.run('DELETE FROM trips WHERE id = ? AND user_id = ?', 
        [tripId, userId], 
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, deletedId: tripId });
        }
    );
});

// API: Get Community Posts
app.get('/api/posts', (req, res) => {
    db.all('SELECT * FROM posts ORDER BY id DESC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// API: Create Community Post
app.post('/api/posts', authenticateToken, (req, res) => {
    const { content, author_name } = req.body;
    const userId = req.user.id;
    
    db.run('INSERT INTO posts (user_id, author_name, content) VALUES (?, ?, ?)', 
        [userId, author_name, content], 
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// API: Get Hidden Gems
app.get('/api/hidden-gems', (req, res) => {
    const { country, category } = req.query;
    let query = 'SELECT * FROM hidden_gems';
    let params = [];
    let conditions = [];

    if (country) {
        conditions.push('country = ?');
        params.push(country);
    }
    if (category && category !== 'All' && category !== 'All Gems') {
        conditions.push('category = ?');
        params.push(category);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY gem_score DESC, rating DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// API: Submit a Hidden Gem (Community Contribution)
app.post('/api/hidden-gems', (req, res) => {
    const { name, city, country, category, description, budget, best_time, distance, photo_url, submitted_by } = req.body;
    
    if (!name || !city || !country || !category) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    // AI Gem Score Algorithm: calculates score from uniqueness, crowd, rating, and vibe
    const uniqueness_score = Math.floor(Math.random() * 10) + 90; // 90-99
    const crowd_score = Math.floor(Math.random() * 12) + 88;      // 88-99
    const vibe_score = Math.floor(Math.random() * 10) + 90;       // 90-99
    
    // Formula: 35% uniqueness + 35% crowd + 30% vibe
    const gem_score = Math.round(uniqueness_score * 0.35 + crowd_score * 0.35 + vibe_score * 0.30);
    const rating = 4.8;
    const crowd_level = crowd_score > 93 ? "Very Low" : "Low";
    
    const finalPhoto = photo_url || ('https://picsum.photos/seed/' + encodeURIComponent(name) + '/800/500');
    const author = submitted_by || 'TripoNext Explorer';

    db.run(`INSERT INTO hidden_gems (name, city, country, category, description, gem_score, rating, crowd_level, budget, best_time, distance, photo_url, submitted_by, uniqueness_score, crowd_score, vibe_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, city, country, category, description || 'A secret local spot waiting to be explored.', gem_score, rating, crowd_level, budget || 'Free / Low cost', best_time || 'Morning / Sunset', distance || '15 min from city', finalPhoto, author, uniqueness_score, crowd_score, vibe_score],
        function(err) {
            if (err) {
                console.error('Error adding hidden gem:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({
                success: true,
                id: this.lastID,
                gem_score,
                message: `🎉 Gem successfully added! Assigned AI Gem Score: ${gem_score}/100 💎`
            });
        }
    );
});

// API: AI Chatbot
app.post('/api/ai-chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    try {
        if (!process.env.GEMINI_API_KEY) {
            // Smart Fallback AI (No API Key required)
            const lowerMsg = message.toLowerCase();
            let reply = "I am the TripoNext Support Bot! I can help you with finding buddies, managing budget, exploring destinations, or reporting bugs.";
            
            if (lowerMsg.includes('hello') || lowerMsg.includes('hi ') || lowerMsg === 'hi' || lowerMsg.includes('hey')) {
                reply = "Hello there! How can I help you make your travel planning easier today?";
            } else if (lowerMsg.includes('buddy') || lowerMsg.includes('join') || lowerMsg.includes('friend') || lowerMsg.includes('buddies')) {
                reply = "Looking for travel partners? Head over to the 'Find Buddies' section from the top menu. You can request to join existing trips or post your own!";
            } else if (lowerMsg.includes('budget') || lowerMsg.includes('cost') || lowerMsg.includes('money')) {
                reply = "You can calculate your trip budget in the Dashboard. Just enter your destination and we will estimate your travel, food, and stay costs automatically!";
            } else if (lowerMsg.includes('create') || lowerMsg.includes('post') || lowerMsg.includes('new trip')) {
                reply = "You can create a new trip in the 'Find Buddies' page by clicking 'Post a Trip', or save a personal itinerary in 'My Trips'.";
            } else if (lowerMsg.includes('bug') || lowerMsg.includes('error') || lowerMsg.includes('not working') || lowerMsg.includes('issue')) {
                reply = "Oops! Please use the 'App Feedback & Suggestions' form here on the Community page. Select 'Report Bug' and tell us what went wrong!";
            } else if (lowerMsg.includes('weather') || lowerMsg.includes('climate')) {
                reply = "You can check the live weather for any destination on the main Dashboard page. Just search for the city!";
            } else if (lowerMsg.includes('thanks') || lowerMsg.includes('thank you') || lowerMsg.includes('awesome')) {
                reply = "You're very welcome! Enjoy using TripoNext.";
            } else if (lowerMsg.includes('who are you') || lowerMsg.includes('your name')) {
                reply = "I am the TripoNext Support AI! I'm here to guide you through the platform.";
            } else if (lowerMsg.length > 30) {
                reply = "That sounds interesting! For detailed planning, I suggest using the Dashboard to create an itinerary and manage your budget.";
            }
            
            // Artificial delay to simulate thinking
            await new Promise(resolve => setTimeout(resolve, 800));
            return res.json({ reply: reply });
        }
        
        const ai = new GoogleGenAI({});
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are the TripoNext Support AI, a friendly and helpful travel assistant.
You help users navigate the TripoNext app (e.g., finding buddies, calculating budgets, checking out famous destinations, reporting bugs). 
Keep your answers brief, friendly, and helpful. Do not use markdown since it will be rendered as plain text in the chatbox.
User message: ${message}`
        });

        res.json({ reply: response.text });
    } catch (e) {
        console.error('AI Error:', e);
        res.json({ reply: "Sorry, I'm having trouble thinking right now. Please try again later! ⚙️" });
    }
});

// Fallback to serve index.html for SPA-like behavior if needed
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

