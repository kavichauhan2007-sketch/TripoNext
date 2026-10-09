const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();
const { generateDynamicPlan } = require('./itineraryEngine');

const app = express();
const PORT = 3001;
const SECRET_KEY = 'super_secret_travel_buddy_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
const dbPath = process.env.VERCEL ? '/tmp/database.sqlite' : './database.sqlite';
const db = new sqlite3.Database(dbPath, (err) => {
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
        )`, () => {
            ['phone', 'bio', 'avatar', 'home_city', 'travel_style', 'referral_code', 'referral_credits'].forEach(col => {
                db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT`, () => {});
            });
        });

        // Create Bookings table (Hotels, Cabs, Flights, Buses)
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT,
            title TEXT,
            subtitle TEXT,
            details TEXT,
            price REAL,
            currency TEXT DEFAULT 'INR',
            status TEXT DEFAULT 'Confirmed',
            booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            travel_date TEXT,
            booking_ref TEXT,
            origin TEXT,
            destination TEXT
        )`);

        // Create Feedback and Reviews table
        db.run(`CREATE TABLE IF NOT EXISTS feedback_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_name TEXT,
            category TEXT,
            rating INTEGER,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Support Tickets table
        db.run(`CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_name TEXT,
            user_email TEXT,
            subject TEXT,
            message TEXT,
            status TEXT DEFAULT 'Open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Trips table
        db.run(`CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            destination TEXT,
            dates TEXT,
            budget REAL,
            itinerary TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, () => {
            db.run(`ALTER TABLE trips ADD COLUMN itinerary TEXT`, () => {});
        });

        // Create Buddy Messages table
        db.run(`CREATE TABLE IF NOT EXISTS buddy_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            sender_name TEXT,
            receiver_name TEXT,
            trip_destination TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.get("SELECT COUNT(*) as count FROM buddy_messages", [], (err, row) => {
                if (row && row.count === 0) {
                    const sampleMessages = [
                        { sender_id: 1, sender_name: "Rahul S.", receiver_name: "You", trip_destination: "Manali, Himachal", message: "Hey! Super excited for the Manali road trip. We're planning to stop by Solang Valley and Sissu waterfall." },
                        { sender_id: 2, sender_name: "Ananya D.", receiver_name: "You", trip_destination: "Gokarna, Karnataka", message: "Hi buddy! Kudle beach hostel is booked. Don't forget your trekking shoes for the beach trail!" }
                    ];
                    const stmt = db.prepare(`INSERT INTO buddy_messages (sender_id, sender_name, receiver_name, trip_destination, message) VALUES (?, ?, ?, ?, ?)`);
                    sampleMessages.forEach(m => stmt.run(m.sender_id, m.sender_name, m.receiver_name, m.trip_destination, m.message));
                    stmt.finalize();
                }
            });
        });

        // Create Trip Expenses table
        db.run(`CREATE TABLE IF NOT EXISTS trip_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER,
            user_id INTEGER,
            paid_by TEXT,
            amount REAL,
            description TEXT,
            category TEXT,
            split_with TEXT,
            date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Shared Trip Photos table
        db.run(`CREATE TABLE IF NOT EXISTS trip_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            author_name TEXT,
            destination TEXT,
            caption TEXT,
            photo_url TEXT,
            likes INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.get("SELECT COUNT(*) as count FROM trip_photos", [], (err, row) => {
                if (row && row.count === 0) {
                    const samplePhotos = [
                        { author_name: "Amit K.", destination: "Jaipur, India", caption: "Pink City sunset from the secret fort ridge. Unmatched vibes!", photo_url: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80", likes: 42 },
                        { author_name: "Pooja V.", destination: "Kyoto, Japan", caption: "Early morning serenity in Arashiyama bamboo path before crowds arrived 🎋", photo_url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80", likes: 58 },
                        { author_name: "Rohan S.", destination: "Spiti Valley, India", caption: "Chilly morning ride across Kunzum Pass with my travel buddy! ❄️🏍️", photo_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80", likes: 89 },
                        { author_name: "Sneha M.", destination: "Paris, France", caption: "Croissant & coffee near Montmartre secret vineyard alley ☕✨", photo_url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80", likes: 37 }
                    ];
                    const stmt = db.prepare(`INSERT INTO trip_photos (author_name, destination, caption, photo_url, likes) VALUES (?, ?, ?, ?, ?)`);
                    samplePhotos.forEach(p => stmt.run(p.author_name, p.destination, p.caption, p.photo_url, p.likes));
                    stmt.finalize();
                }
            });
        });

        // Create Notifications table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            message TEXT,
            type TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.get("SELECT COUNT(*) as count FROM notifications", [], (err, row) => {
                if (row && row.count === 0) {
                    const sampleNotifs = [
                        { title: "Buddy Request Accepted 🎉", message: "Rahul S. accepted your join request for the Manali Roadtrip! Say hi in chat.", type: "buddy" },
                        { title: "Weather Update ☀️", message: "Sunny skies and clear weather expected for your upcoming trip.", type: "weather" },
                        { title: "Expense Splitter Active 💸", message: "Keep track of who paid what during your adventures with the new Expense Splitter in My Trips.", type: "system" }
                    ];
                    const stmt = db.prepare(`INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)`);
                    sampleNotifs.forEach(n => stmt.run(n.title, n.message, n.type));
                    stmt.finalize();
                }
            });
        });

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
    const { destination, dates, budget, itinerary } = req.body;
    const userId = req.user.id;
    const itVal = itinerary ? (typeof itinerary === 'object' ? JSON.stringify(itinerary) : itinerary) : null;
    
    db.run('INSERT INTO trips (user_id, destination, dates, budget, itinerary) VALUES (?, ?, ?, ?, ?)', 
        [userId, destination, dates, budget, itVal], 
        function(err) {
            if (err) {
                // Fallback if schema doesn't have itinerary
                db.run('INSERT INTO trips (user_id, destination, dates, budget) VALUES (?, ?, ?, ?)',
                    [userId, destination, dates, budget],
                    function(err2) {
                        if (err2) return res.status(500).json({ error: 'Database error' });
                        res.json({ id: this.lastID, destination, dates, budget });
                    }
                );
                return;
            }
            res.json({ id: this.lastID, destination, dates, budget, itinerary: itVal });
        }
    );
});

// API: Get My Trips
app.get('/api/trips', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    db.all('SELECT * FROM trips WHERE user_id = ? ORDER BY id DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        // Parse JSON itinerary if present
        const parsed = (rows || []).map(r => {
            if (r.itinerary) {
                try { r.itinerary = JSON.parse(r.itinerary); } catch(e){}
            }
            return r;
        });
        res.json(parsed);
    });
});

// API: Update Trip
app.put('/api/trips/:id', authenticateToken, (req, res) => {
    const { destination, dates, budget, itinerary } = req.body;
    const userId = req.user.id;
    const tripId = req.params.id;
    const itVal = itinerary ? (typeof itinerary === 'object' ? JSON.stringify(itinerary) : itinerary) : null;
    
    db.run('UPDATE trips SET destination = ?, dates = ?, budget = ?, itinerary = ? WHERE id = ? AND user_id = ?', 
        [destination, dates, budget, itVal, tripId, userId], 
        function(err) {
            if (err) {
                db.run('UPDATE trips SET destination = ?, dates = ?, budget = ? WHERE id = ? AND user_id = ?',
                    [destination, dates, budget, tripId, userId],
                    function(err2) {
                        if (err2) return res.status(500).json({ error: 'Database error' });
                        res.json({ success: true });
                    }
                );
                return;
            }
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
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
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

// API: AI Itinerary Generator (Gemini + Smart Authentic Travel Planner Engine)
app.post('/api/ai-itinerary', async (req, res) => {
    const { destination, days = 3, budget = 15000, currency = "INR", travelers = 1, style = "Balanced" } = req.body;
    if (!destination) return res.status(400).json({ error: 'Destination is required' });
    const numDays = Math.min(Math.max(parseInt(days) || 3, 1), 7);

    // If Gemini API Key exists, try generating with Gemini
    if (process.env.GEMINI_API_KEY) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const prompt = `Generate a realistic and exciting ${numDays}-day travel itinerary for ${destination}.
Travel style: ${style}, Travelers: ${travelers}, Total Budget: ${currency} ${budget}.
Include actual famous landmarks, authentic local food specialties, and realistic morning/afternoon/evening schedule.
Return strictly valid JSON only without markdown or backticks in this exact schema:
{
  "destination": "${destination}",
  "days": ${numDays},
  "summary": "Brief 2-line exciting summary of the trip",
  "vibe": "Adventure / Cultural / Relaxed / Romantic",
  "budgetBreakdown": { "stay": "estimated amount", "food": "estimated amount", "activities": "estimated amount", "transport": "estimated amount" },
  "packingList": ["item 1", "item 2", "item 3", "item 4"],
  "insiderTips": ["tip 1", "tip 2", "tip 3"],
  "dailyPlan": [
    {
      "day": 1,
      "theme": "Day theme (e.g. Arrival, Old Town Vibe & Sunset Eats)",
      "morning": { "time": "09:00 AM", "activity": "Name of morning spot/activity", "location": "Exact landmark", "tip": "Insider morning tip" },
      "afternoon": { "time": "01:30 PM", "activity": "Name of lunch & afternoon activity", "location": "Exact landmark", "tip": "Food or crowd tip" },
      "evening": { "time": "06:30 PM", "activity": "Sunset/night activity or dining", "location": "Exact landmark", "tip": "Evening vibe tip" }
    }
  ]
}`;
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt
            });
            let cleanText = response.text.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
            }
            const parsed = JSON.parse(cleanText);
            return res.json(parsed);
        } catch (e) {
            console.warn('Gemini itinerary generation failed, switching to Smart Authentic Engine:', e.message);
        }
    }

    // High quality authentic curated itinerary engine
    const curatedPlan = generateDynamicPlan(destination, numDays, budget, currency, style);
    res.json(curatedPlan);
});

// API: Get Buddy Messages / Chats
app.get('/api/messages', (req, res) => {
    const { buddy } = req.query;
    let query = 'SELECT * FROM buddy_messages';
    let params = [];
    if (buddy) {
        query += ' WHERE sender_name = ? OR receiver_name = ?';
        params = [buddy, buddy];
    }
    query += ' ORDER BY id ASC LIMIT 100';
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// API: Send Buddy Message
app.post('/api/messages', (req, res) => {
    const { sender_name = "You", receiver_name, trip_destination, message } = req.body;
    if (!message || !receiver_name) return res.status(400).json({ error: 'Message and receiver are required' });

    db.run('INSERT INTO buddy_messages (sender_id, sender_name, receiver_name, trip_destination, message) VALUES (?, ?, ?, ?, ?)',
        [1, sender_name, receiver_name, trip_destination || "Trip", message],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            const insertedId = this.lastID;
            
            // Smart auto-reply after short delay if chatting with an organizer
            const autoReplies = {
                "Rahul S.": "Hey! Thanks for messaging. We have 2 spots left for Manali. Are you comfortable with a road trip from Delhi?",
                "Ananya D.": "Awesome! We're doing Gokarna next month. Let me know if you prefer beach hostel or private room!",
                "Vikram R.": "Spiti requires heavy winter jackets! Let me know if you have road-trip experience.",
                "Priya M.": "Udaipur is magical! We booked a heritage haveli near Lake Pichola. Super happy to have you join!"
            };

            res.json({ success: true, id: insertedId, message: { id: insertedId, sender_name, receiver_name, message, timestamp: new Date() } });

            if (autoReplies[receiver_name] && sender_name === "You") {
                setTimeout(() => {
                    db.run('INSERT INTO buddy_messages (sender_id, sender_name, receiver_name, trip_destination, message) VALUES (?, ?, ?, ?, ?)',
                        [2, receiver_name, "You", trip_destination || "Trip", autoReplies[receiver_name]]
                    );
                }, 1200);
            }
        }
    );
});

// API: Get Trip Expenses
app.get('/api/trips/:id/expenses', (req, res) => {
    const tripId = req.params.id;
    db.all('SELECT * FROM trip_expenses WHERE trip_id = ? ORDER BY id DESC', [tripId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// API: Add Trip Expense
app.post('/api/trips/:id/expenses', (req, res) => {
    const tripId = req.params.id;
    const { paid_by, amount, description, category, split_with, date } = req.body;
    if (!paid_by || !amount || !description) return res.status(400).json({ error: 'Missing required fields' });

    db.run('INSERT INTO trip_expenses (trip_id, user_id, paid_by, amount, description, category, split_with, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [tripId, 1, paid_by, parseFloat(amount), description, category || "General", split_with || "All", date || new Date().toISOString().split('T')[0]],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// API: Delete Trip Expense
app.delete('/api/trips/:id/expenses/:expId', (req, res) => {
    const { id: tripId, expId } = req.params;
    db.run('DELETE FROM trip_expenses WHERE id = ? AND trip_id = ?', [expId, tripId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// API: Get Trip Photos
app.get('/api/photos', (req, res) => {
    db.all('SELECT * FROM trip_photos ORDER BY id DESC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// API: Post Trip Photo
app.post('/api/photos', (req, res) => {
    const { author_name = "You", destination, caption, photo_url } = req.body;
    if (!destination || !photo_url) return res.status(400).json({ error: 'Destination and photo URL are required' });

    db.run('INSERT INTO trip_photos (user_id, author_name, destination, caption, photo_url, likes) VALUES (?, ?, ?, ?, ?, 0)',
        [1, author_name, destination, caption || "Unforgettable trip moments!", photo_url],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// API: Like Trip Photo
app.post('/api/photos/:id/like', (req, res) => {
    const photoId = req.params.id;
    db.run('UPDATE trip_photos SET likes = likes + 1 WHERE id = ?', [photoId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// API: Get Notifications
app.get('/api/notifications', (req, res) => {
    db.all('SELECT * FROM notifications ORDER BY id DESC LIMIT 20', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// API: Mark Notifications Read
app.post('/api/notifications/read-all', (req, res) => {
    db.run('UPDATE notifications SET is_read = 1', [], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// ========================================================
// 1. USER PROFILE & REFERRAL APIS
// ========================================================
app.get('/api/user/profile', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.json({
            name: "Rahul Sharma",
            email: "rahul.traveler@triponext.com",
            phone: "+91 98765 43210",
            bio: "Passionate road-tripper, mountain lover & culture explorer.",
            avatar: "avatar-1",
            home_city: "Delhi, India",
            travel_style: "Adventure & Cultural",
            referral_code: "TRIP-7492",
            referral_credits: 500
        });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        db.get('SELECT id, name, email, phone, bio, avatar, home_city, travel_style, referral_code, referral_credits FROM users WHERE id = ?', [decoded.id], (dbErr, user) => {
            if (dbErr || !user) {
                return res.json({
                    id: decoded.id,
                    name: decoded.name || "Rahul Sharma",
                    email: decoded.email,
                    phone: "+91 98765 43210",
                    bio: "Wanderlust-driven explorer discovering secret gems.",
                    avatar: "avatar-1",
                    home_city: "Delhi, India",
                    travel_style: "Balanced",
                    referral_code: "TRIP-" + (decoded.id * 73 + 1204),
                    referral_credits: 500
                });
            }
            if (!user.referral_code) {
                const refCode = "TRIP-" + (user.id * 73 + 1204);
                db.run('UPDATE users SET referral_code = ?, referral_credits = 500 WHERE id = ?', [refCode, user.id]);
                user.referral_code = refCode;
                user.referral_credits = 500;
            }
            res.json(user);
        });
    });
});

app.put('/api/user/profile', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const { name, phone, bio, avatar, home_city, travel_style } = req.body;

    if (!token) {
        return res.json({ success: true, message: "Profile saved locally", user: req.body });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        db.run(
            'UPDATE users SET name = COALESCE(?, name), phone = ?, bio = ?, avatar = ?, home_city = ?, travel_style = ? WHERE id = ?',
            [name, phone, bio, avatar, home_city, travel_style, decoded.id],
            function(dbErr) {
                if (dbErr) return res.status(500).json({ error: 'Database update failed' });
                res.json({ success: true, user: { id: decoded.id, name, phone, bio, avatar, home_city, travel_style } });
            }
        );
    });
});

app.get('/api/user/referrals', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = 1;
    if (token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    const refCode = "TRIP-" + (userId * 137 + 1024);
    res.json({
        referral_code: refCode,
        share_url: `https://triponext.com/join?ref=${refCode}`,
        referral_credits: 500,
        currency: "₹",
        per_invite_bonus: 250,
        friends_invited: 2,
        invited_list: [
            { name: "Aarav Sharma", status: "Joined & Booked", reward: "+₹250", date: "2 days ago" },
            { name: "Pooja Verma", status: "Registered", reward: "+₹250", date: "Last week" }
        ]
    });
});

// ========================================================
// 2. HOTEL, CAB, FLIGHT & BUS BOOKING APIS
// ========================================================

// Hotels API
app.get('/api/bookings/hotels', (req, res) => {
    const { city = "Manali" } = req.query;
    const cleanCity = city.trim();

    const hotelCatalog = [
        {
            id: 'htl-1',
            name: `${cleanCity} Grand Heritage Resort & Spa`,
            city: cleanCity,
            rating: 4.8,
            reviewsCount: 420,
            pricePerNight: 3499,
            currency: 'INR',
            stars: 5,
            tag: 'Top Rated',
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
            amenities: ['Free WiFi', 'Infinity Pool', 'Complimentary Breakfast', 'Mountain View', 'Spa'],
            cancellation: 'Free Cancellation before 24h',
            address: `Near Mall Road, ${cleanCity}`
        },
        {
            id: 'htl-2',
            name: `Zostel & Backpacker Hub ${cleanCity}`,
            city: cleanCity,
            rating: 4.6,
            reviewsCount: 910,
            pricePerNight: 899,
            currency: 'INR',
            stars: 3,
            tag: 'Backpacker Favorite',
            image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
            amenities: ['Free WiFi', 'Co-working Cafe', 'Community Lounge', 'Bicycle Rental', 'Bonfire'],
            cancellation: 'Free Cancellation up to 48h',
            address: `Old Town Ridge, ${cleanCity}`
        },
        {
            id: 'htl-3',
            name: `The Royal Vista Boutique Suites`,
            city: cleanCity,
            rating: 4.7,
            reviewsCount: 280,
            pricePerNight: 2199,
            currency: 'INR',
            stars: 4,
            tag: 'Best Value',
            image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
            amenities: ['Free High-Speed WiFi', 'Rooftop Dining', 'Airport Shuttle', 'King Bed', 'AC'],
            cancellation: 'Instant Confirmation Deal',
            address: `Central Plaza, ${cleanCity}`
        },
        {
            id: 'htl-4',
            name: `Serene Alpine Pine Cottages`,
            city: cleanCity,
            rating: 4.9,
            reviewsCount: 165,
            pricePerNight: 4899,
            currency: 'INR',
            stars: 5,
            tag: 'Luxury Pick',
            image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
            amenities: ['Wooden Fireplace', 'Private Balcony', 'Butler Service', 'Organic Farm Breakfast', 'Jacuzzi'],
            cancellation: 'Free Cancellation anytime',
            address: `Valley Road, Upper ${cleanCity}`
        }
    ];

    res.json({
        city: cleanCity,
        count: hotelCatalog.length,
        hotels: hotelCatalog
    });
});

// Cabs API
app.get('/api/bookings/cabs', (req, res) => {
    const { pickup = "Current Location", drop = "Destination" } = req.query;

    const cabOptions = [
        {
            id: 'cab-mini',
            category: 'Go Mini',
            vehicle: 'Maruti WagonR / Swift',
            eta: '3 mins away',
            capacity: '4 Seats • 1 Small Bag',
            rating: 4.8,
            driverTrips: 1840,
            baseFare: 120,
            perKm: 14,
            estimatedFare: 380,
            currency: 'INR',
            icon: 'fa-car-side',
            tag: 'Cheapest',
            badgeColor: '#10b981',
            features: ['AC Cab', 'Clean & Sanitized', 'Top-rated Driver']
        },
        {
            id: 'cab-sedan',
            category: 'Prime Sedan',
            vehicle: 'Maruti Dzire / Honda Amaze',
            eta: '4 mins away',
            capacity: '4 Seats • 2 Large Bags',
            rating: 4.9,
            driverTrips: 2450,
            baseFare: 160,
            perKm: 18,
            estimatedFare: 490,
            currency: 'INR',
            icon: 'fa-car',
            tag: 'Most Popular',
            badgeColor: '#f97316',
            features: ['Extra Legroom', 'Free In-Cab WiFi', 'Zero Driver Cancellation']
        },
        {
            id: 'cab-suv',
            category: 'Outstation & Airport SUV',
            vehicle: 'Toyota Innova Crysta / Ertiga',
            eta: '6 mins away',
            capacity: '6 Seats • 4 Large Bags',
            rating: 4.9,
            driverTrips: 3100,
            baseFare: 250,
            perKm: 24,
            estimatedFare: 780,
            currency: 'INR',
            icon: 'fa-van-shuttle',
            tag: 'Family & Luggage',
            badgeColor: '#8b5cf6',
            features: ['Spacious 6-7 Seater', 'Roof Luggage Carrier', 'Highway Specialist']
        },
        {
            id: 'cab-ev',
            category: 'Eco Green EV',
            vehicle: 'Tata Nexon EV / Tigor EV',
            eta: '5 mins away',
            capacity: '4 Seats • 2 Bags',
            rating: 4.9,
            driverTrips: 980,
            baseFare: 140,
            perKm: 16,
            estimatedFare: 430,
            currency: 'INR',
            icon: 'fa-charging-station',
            tag: 'Zero Emission',
            badgeColor: '#059669',
            features: ['100% Electric Silent Ride', 'Eco Carbon-Neutral', 'AC']
        },
        {
            id: 'cab-auto',
            category: 'Quick Auto',
            vehicle: 'Bajaj RE Auto',
            eta: '2 mins away',
            capacity: '3 Seats • Handbag',
            rating: 4.7,
            driverTrips: 4200,
            baseFare: 40,
            perKm: 11,
            estimatedFare: 160,
            currency: 'INR',
            icon: 'fa-motorcycle',
            tag: 'Budget Quick',
            badgeColor: '#eab308',
            features: ['Fast city maneuvering', 'No traffic hassle', 'Metered fair rates']
        }
    ];

    res.json({
        pickup,
        drop,
        cabs: cabOptions
    });
});

// Flights API
app.get('/api/bookings/flights', (req, res) => {
    const { from = "DEL", to = "BOM", date = "Tomorrow" } = req.query;

    const flightsList = [
        {
            id: 'flt-1',
            airline: 'IndiGo',
            flightNumber: '6E-2143',
            departureTime: '06:15 AM',
            arrivalTime: '08:30 AM',
            origin: from.toUpperCase(),
            destination: to.toUpperCase(),
            duration: '2h 15m',
            stops: 'Non-stop',
            price: 4350,
            currency: 'INR',
            seatsLeft: 4,
            baggage: '15 Kg Check-in • 7 Kg Cabin',
            tag: 'Fastest & On-Time'
        },
        {
            id: 'flt-2',
            airline: 'Air India',
            flightNumber: 'AI-805',
            departureTime: '09:45 AM',
            arrivalTime: '12:05 PM',
            origin: from.toUpperCase(),
            destination: to.toUpperCase(),
            duration: '2h 20m',
            stops: 'Non-stop',
            price: 4890,
            currency: 'INR',
            seatsLeft: 8,
            baggage: '25 Kg Check-in • 7 Kg Cabin • Free Meal',
            tag: 'Free Hot Meal'
        },
        {
            id: 'flt-3',
            airline: 'Vistara',
            flightNumber: 'UK-942',
            departureTime: '02:30 PM',
            arrivalTime: '04:45 PM',
            origin: from.toUpperCase(),
            destination: to.toUpperCase(),
            duration: '2h 15m',
            stops: 'Non-stop',
            price: 5200,
            currency: 'INR',
            seatsLeft: 6,
            baggage: '15 Kg Check-in • 7 Kg Cabin • In-flight Media',
            tag: 'Premium Luxury'
        },
        {
            id: 'flt-4',
            airline: 'Akasa Air',
            flightNumber: 'QP-1304',
            departureTime: '07:20 PM',
            arrivalTime: '09:40 PM',
            origin: from.toUpperCase(),
            destination: to.toUpperCase(),
            duration: '2h 20m',
            stops: 'Non-stop',
            price: 3890,
            currency: 'INR',
            seatsLeft: 2,
            baggage: '15 Kg Check-in • 7 Kg Cabin',
            tag: 'Lowest Price Today'
        }
    ];

    res.json({
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        date,
        flights: flightsList
    });
});

// Buses API
app.get('/api/bookings/buses', (req, res) => {
    const { from = "Delhi", to = "Manali", date = "Today" } = req.query;

    const busCatalog = [
        {
            id: 'bus-1',
            operator: 'Zingbus Maxx AC',
            busType: 'Volvo 9600 Multi-Axle Luxury Sleeper (2+1)',
            rating: 4.8,
            reviews: 1420,
            departureTime: '08:30 PM',
            arrivalTime: '07:30 AM',
            duration: '11h 00m',
            fromCity: from,
            toCity: to,
            boardingPoint: 'Kashmere Gate ISBT / Majnu Ka Tila',
            dropPoint: 'Private Bus Stand, Mall Road',
            price: 1199,
            currency: 'INR',
            seatsAvailable: 7,
            amenities: ['Blanket & Pillow', 'Charging Socket', 'Live GPS Tracking', 'Emergency SOS', 'Water Bottle'],
            tag: 'Top Rated Volvo'
        },
        {
            id: 'bus-2',
            operator: 'IntrCity SmartBus',
            busType: 'BharatBenz AC Sleeper with Washroom',
            rating: 4.7,
            reviews: 890,
            departureTime: '09:15 PM',
            arrivalTime: '08:15 AM',
            duration: '11h 00m',
            fromCity: from,
            toCity: to,
            boardingPoint: 'RK Ashram Metro / Dhaula Kuan',
            dropPoint: 'Volvoparking Mall Road',
            price: 1399,
            currency: 'INR',
            seatsAvailable: 11,
            amenities: ['In-Bus Washroom', 'Smart Lounge Access', 'WiFi', 'Luggage Tagging'],
            tag: 'Washroom Onboard'
        },
        {
            id: 'bus-3',
            operator: 'NueGo Electric AC Express',
            busType: '100% Electric AC Semi-Sleeper',
            rating: 4.9,
            reviews: 520,
            departureTime: '07:00 PM',
            arrivalTime: '06:00 AM',
            duration: '11h 00m',
            fromCity: from,
            toCity: to,
            boardingPoint: 'Anand Vihar ISBT',
            dropPoint: 'Main Bus Terminal',
            price: 999,
            currency: 'INR',
            seatsAvailable: 14,
            amenities: ['Zero Emission Silent Ride', 'Reclining Seats', 'CCTV Security', 'USB Port'],
            tag: 'Eco Friendly'
        },
        {
            id: 'bus-4',
            operator: 'City Land Travels Gold',
            busType: 'Scania AC Multi-Axle Semi-Sleeper (2+2)',
            rating: 4.5,
            reviews: 310,
            departureTime: '10:00 PM',
            arrivalTime: '09:00 AM',
            duration: '11h 00m',
            fromCity: from,
            toCity: to,
            boardingPoint: 'Kashmere Gate Metro Gate 1',
            dropPoint: 'Mall Road Entrance',
            price: 799,
            currency: 'INR',
            seatsAvailable: 18,
            amenities: ['AC', 'Reading Light', 'Charging Plug'],
            tag: 'Budget Express'
        }
    ];

    res.json({
        from,
        to,
        date,
        buses: busCatalog
    });
});

// Create / Confirm Booking
app.post('/api/bookings/create', (req, res) => {
    const { type, title, item_name, subtitle, details, price, currency = 'INR', travel_date, origin, destination } = req.body;
    const bookingTitle = title || item_name;
    if (!type || !bookingTitle || !price) {
        return res.status(400).json({ error: 'Missing type, title, or price for booking' });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = 1;
    if (token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    const refPrefix = type.toUpperCase().slice(0, 3);
    const booking_ref = `${refPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;

    db.run(
        `INSERT INTO bookings (user_id, type, title, subtitle, details, price, currency, status, travel_date, booking_ref, origin, destination) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?)`,
        [userId, type, bookingTitle, subtitle || '', typeof details === 'object' ? JSON.stringify(details) : (details || ''), price, currency, travel_date || 'Upcoming', booking_ref, origin || '', destination || ''],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to record booking in database' });
            res.json({
                success: true,
                id: this.lastID,
                booking_ref,
                status: 'Confirmed',
                type,
                title: bookingTitle,
                item_name: bookingTitle,
                subtitle,
                price,
                currency,
                travel_date: travel_date || 'Upcoming',
                message: `Booking confirmed successfully! Your booking reference is ${booking_ref}.`
            });
        }
    );
});

// Get My Bookings
app.get('/api/bookings/my-bookings', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = 1;
    if (token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    db.all('SELECT * FROM bookings WHERE user_id = ? ORDER BY id DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching bookings' });
        const mapped = (rows || []).map(r => ({
            ...r,
            title: r.title || r.item_name || 'Travel Booking',
            item_name: r.title || r.item_name || 'Travel Booking'
        }));
        res.json(mapped);
    });
});

// Cancel Booking
app.delete('/api/bookings/:id', (req, res) => {
    const bookingId = req.params.id;
    db.run('UPDATE bookings SET status = "Cancelled" WHERE id = ?', [bookingId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to cancel booking' });
        res.json({ success: true, message: 'Booking has been cancelled.' });
    });
});

// ========================================================
// 3. FEEDBACK & RATINGS APIS
// ========================================================
app.post('/api/feedback', (req, res) => {
    const { name, rating, category, comment } = req.body;
    if (!rating) return res.status(400).json({ error: 'Rating is required' });

    db.run(
        'INSERT INTO feedback_reviews (user_name, rating, category, comment) VALUES (?, ?, ?, ?)',
        [name || 'Anonymous Traveler', parseInt(rating), category || 'General App', comment || ''],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to save feedback' });
            res.json({ success: true, id: this.lastID, message: 'Thank you for your valuable feedback and rating!' });
        }
    );
});

app.get('/api/feedback', (req, res) => {
    db.all('SELECT * FROM feedback_reviews ORDER BY id DESC LIMIT 20', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

// ========================================================
// 4. OFFERS & DISCOUNTS APIS
// ========================================================
app.get('/api/offers', (req, res) => {
    const offers = [
        {
            code: 'AIRFLY25',
            title: 'Flat 25% OFF Flights',
            desc: 'Save up to ₹2,500 on all domestic & international flight tickets.',
            type: 'flight',
            discount: '25% OFF',
            minBooking: '₹4,000',
            expiry: 'Valid till 30 Nov'
        },
        {
            code: 'STAYLUXE',
            title: 'Flat ₹1,500 OFF Hotels',
            desc: 'Applicable on 4-star & 5-star resorts, boutique hotels and homestays.',
            type: 'hotel',
            discount: '₹1,500 OFF',
            minBooking: '₹3,500',
            expiry: 'Valid till 15 Dec'
        },
        {
            code: 'CABSAFE',
            title: '20% OFF Airport & Cabs',
            desc: 'Get instant 20% discount on Sedan and SUV intercity outstation rides.',
            type: 'cab',
            discount: '20% OFF',
            minBooking: '₹300',
            expiry: 'Always Active'
        },
        {
            code: 'BUSWAY150',
            title: 'Flat ₹150 OFF AC Volvo Buses',
            desc: 'Save on long-distance Volvo, BharatBenz & electric sleeper bus seats.',
            type: 'bus',
            discount: '₹150 OFF',
            minBooking: '₹600',
            expiry: 'Valid this month'
        },
        {
            code: 'TRIPNEXT500',
            title: 'Welcome Bonus: ₹500 Instant Credit',
            desc: 'Special new user welcome voucher applicable across all transit & hotel bookings.',
            type: 'general',
            discount: '₹500 OFF',
            minBooking: '₹1,000',
            expiry: 'Lifetime for New Users'
        }
    ];
    res.json({ count: offers.length, offers });
});

// ========================================================
// 5. HELP & SUPPORT APIS
// ========================================================
app.get('/api/support/faqs', (req, res) => {
    const faqs = [
        {
            q: "How do I cancel or reschedule my hotel or flight booking?",
            a: "Go to Profile > My Trips or Bookings Hub, select the booking, and tap 'Cancel Booking'. Free cancellations are processed automatically within 2-4 business days."
        },
        {
            q: "How does the Offline Mode work without internet?",
            a: "When you have internet, tap 'Save for Offline' on any itinerary in Dashboard or My Trips. The app stores all details locally on your phone so you can navigate without WiFi or cellular data."
        },
        {
            q: "How does the Refer and Earn program reward me?",
            a: "Share your unique referral code with friends. When they sign up and plan or book their first adventure, both of you receive ₹250 wallet credits instantly."
        },
        {
            q: "Can I connect and chat with verified travel buddies?",
            a: "Yes! Use the 'Find Buddies' section. All verified organizers have blue checkmarks. You can chat directly, split fuel or stays, and share trip photos on the Community wall."
        },
        {
            q: "How do I clear cached offline trips if old data is showing?",
            a: "Open Settings > Offline Manager, and click 'Clear Offline Cache'. This purges all old cached records and syncs freshly with the cloud."
        }
    ];
    res.json({ faqs });
});

app.post('/api/support/ticket', (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    db.run(
        'INSERT INTO support_tickets (user_name, user_email, subject, message) VALUES (?, ?, ?, ?)',
        [name || 'Traveler', email || 'user@example.com', subject || 'Help Request', message],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to record support ticket' });
            res.json({
                success: true,
                ticketId: `TICK-${this.lastID + 100}`,
                message: "Our 24x7 support team has received your ticket and will respond within 30 minutes!"
            });
        }
    );
});

// Fallback to serve index.html for SPA-like behavior if needed
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;

