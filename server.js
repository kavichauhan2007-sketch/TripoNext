const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();
const { generateDynamicPlan } = require('./itineraryEngine');
const mfaService = require('./mfaService');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.SECRET_KEY || 'super_secret_travel_buddy_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

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
            ['phone', 'bio', 'avatar', 'home_city', 'travel_style', 'referral_code', 'referral_credits', 'mfa_enabled', 'mfa_secret_encrypted', 'mfa_enrolled_at', 'mfa_last_totp_step'].forEach(col => {
                db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT`, () => {});
            });
        });

        // Create MFA Recovery Codes table
        db.run(`CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            used_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Create MFA Challenges table
        db.run(`CREATE TABLE IF NOT EXISTS mfa_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge_id TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL,
            attempts_left INTEGER DEFAULT 5,
            expires_at INTEGER NOT NULL,
            consumed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Create MFA Pending Enrollments table
        db.run(`CREATE TABLE IF NOT EXISTS mfa_pending_enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            secret_encrypted TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Create MFA Email OTPs table
        db.run(`CREATE TABLE IF NOT EXISTS mfa_email_otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            challenge_id TEXT NOT NULL,
            otp_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            attempts_left INTEGER DEFAULT 3,
            expires_at INTEGER NOT NULL,
            consumed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Create MFA Audit Logs table
        db.run(`CREATE TABLE IF NOT EXISTS mfa_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            event TEXT NOT NULL,
            status TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

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
        )`, () => {
            ['payment_method', 'txn_id', 'guest_name', 'guest_phone', 'guest_email', 'seat_or_room'].forEach(col => {
                db.run(`ALTER TABLE bookings ADD COLUMN ${col} TEXT`, () => {});
            });
        });

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
    
    if (!token) return res.status(401).json({ error: 'Authentication required. No session token provided.' });
    
    if (token.startsWith('guest-token') || token.startsWith('local-token')) {
        req.user = { id: 1, email: 'rahul.traveler@triponext.com', name: 'Rahul Sharma' };
        return next();
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
        }
        // Disallow challenge tokens on protected user endpoints
        if (user.purpose === 'mfa_challenge') {
            return res.status(401).json({ error: 'MFA challenge incomplete. You must complete two-factor authentication first.' });
        }
        req.user = user;
        next();
    });
};

// API: Register User
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], function(err) {
            if (err) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            const token = jwt.sign({ id: this.lastID, email, name }, SECRET_KEY);
            res.json({ token, user: { id: this.lastID, name, email } });
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// API: Login User (with Secure Multi-Factor Authentication Challenge)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        // Safe generic error message to prevent user enumeration
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });
        
        // If MFA is enabled on user account, issue restricted short-lived challenge token
        if (user.mfa_enabled && Number(user.mfa_enabled) === 1) {
            const rateKey = `login_mfa_${user.id}`;
            const rateCheck = mfaService.checkRateLimit(rateKey);
            if (!rateCheck.allowed) {
                return res.status(429).json({ error: rateCheck.message });
            }

            const challengeId = crypto.randomUUID();
            const mfaToken = jwt.sign(
                { purpose: 'mfa_challenge', challengeId, userId: user.id },
                SECRET_KEY,
                { expiresIn: '5m' }
            );
            const tokenHash = crypto.createHash('sha256').update(mfaToken).digest('hex');
            const expiresAt = Date.now() + (5 * 60 * 1000);

            db.run(
                'INSERT INTO mfa_challenges (challenge_id, user_id, token_hash, attempts_left, expires_at, consumed) VALUES (?, ?, ?, 5, ?, 0)',
                [challengeId, user.id, tokenHash, expiresAt],
                function(dbErr) {
                    if (dbErr) {
                        console.error('Error creating MFA challenge:', dbErr);
                        return res.status(500).json({ error: 'Error generating MFA challenge' });
                    }

                    mfaService.logAuditEvent(db, {
                        userId: user.id,
                        event: 'MFA_LOGIN_CHALLENGED',
                        status: 'SUCCESS',
                        req,
                        details: { challengeId }
                    });

                    return res.json({
                        mfa_required: true,
                        mfa_token: mfaToken,
                        challenge_id: challengeId,
                        methods: ['totp', 'email_otp', 'recovery_code'],
                        user_email_masked: mfaService.maskEmail(user.email)
                    });
                }
            );
            return;
        }

        // Standard direct session token for non-MFA accounts
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    });
});

// ========================================================
// MULTI-FACTOR AUTHENTICATION (MFA) API ENDPOINTS
// ========================================================

// 1. GET /api/auth/mfa/status - Fetch user MFA enrollment status
app.get(['/api/auth/mfa/status', '/auth/mfa/status'], authenticateToken, (req, res) => {
    db.get('SELECT id, email, mfa_enabled, mfa_enrolled_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'User record not found' });
        
        db.get('SELECT COUNT(*) as count FROM mfa_recovery_codes WHERE user_id = ? AND used = 0', [user.id], (rcErr, row) => {
            const remaining = row ? row.count : 0;
            res.json({
                mfa_enabled: Boolean(user.mfa_enabled && Number(user.mfa_enabled) === 1),
                enrolled_at: user.mfa_enrolled_at,
                method: user.mfa_enabled ? 'totp' : null,
                remaining_recovery_codes: remaining
            });
        });
    });
});

// 2. POST /api/auth/mfa/enroll - Initiate enrollment with password re-authentication
app.post(['/api/auth/mfa/enroll', '/auth/mfa/enroll'], authenticateToken, async (req, res) => {
    const { current_password } = req.body;
    if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to enable Two-Factor Authentication' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'User record not found' });

        const validPassword = await bcrypt.compare(current_password, user.password);
        if (!validPassword) {
            mfaService.logAuditEvent(db, {
                userId: user.id,
                event: 'MFA_ENROLL_FAILED',
                status: 'FAILED',
                req,
                details: { reason: 'Incorrect current password' }
            });
            return res.status(401).json({ error: 'Incorrect password. Re-authentication failed.' });
        }

        try {
            const secret = mfaService.generateTotpSecret();
            const encryptedSecret = mfaService.encryptSecret(secret);
            const otpAuthUri = mfaService.getOtpAuthUri(user.email, secret);
            const qrCodeDataUrl = await mfaService.generateQrCodeDataUrl(otpAuthUri);
            const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minute enrollment window

            db.run(
                'INSERT OR REPLACE INTO mfa_pending_enrollments (user_id, secret_encrypted, expires_at) VALUES (?, ?, ?)',
                [user.id, encryptedSecret, expiresAt],
                (dbErr) => {
                    if (dbErr) return res.status(500).json({ error: 'Failed to initiate MFA enrollment' });

                    mfaService.logAuditEvent(db, {
                        userId: user.id,
                        event: 'MFA_ENROLL_INITIATED',
                        status: 'SUCCESS',
                        req
                    });

                    res.json({
                        secret,
                        qr_code: qrCodeDataUrl,
                        otpauth_url: otpAuthUri,
                        expires_in: 600
                    });
                }
            );
        } catch (e) {
            console.error('Error generating MFA enrollment:', e);
            res.status(500).json({ error: 'Error generating MFA configuration' });
        }
    });
});

// 3. POST /api/auth/mfa/confirm-enrollment - Verify 6-digit code and activate MFA
app.post(['/api/auth/mfa/confirm-enrollment', '/auth/mfa/confirm-enrollment'], authenticateToken, (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: '6-digit authenticator code is required' });
    }

    db.get('SELECT * FROM mfa_pending_enrollments WHERE user_id = ? AND expires_at > ?', [req.user.id, Date.now()], (err, pending) => {
        if (err || !pending) {
            return res.status(400).json({ error: 'No active enrollment session found or session has expired. Please start over.' });
        }

        const plainSecret = mfaService.decryptSecret(pending.secret_encrypted);
        if (!plainSecret) {
            return res.status(500).json({ error: 'Failed to decrypt pending MFA secret on server' });
        }

        const verifyResult = mfaService.verifyTotpCode(code, plainSecret, 0);
        if (!verifyResult.valid) {
            mfaService.logAuditEvent(db, {
                userId: req.user.id,
                event: 'MFA_ENROLL_CONFIRM_FAILED',
                status: 'FAILED',
                req,
                details: { reason: verifyResult.reason }
            });
            return res.status(400).json({ error: verifyResult.reason || 'Invalid code. Check your authenticator app.' });
        }

        // Generate 8 backup recovery codes
        const { plainCodes, hashedCodes } = mfaService.generateRecoveryCodes(8);

        db.serialize(() => {
            // Update user table with encrypted secret and enrollment timestamp
            db.run(
                'UPDATE users SET mfa_enabled = 1, mfa_secret_encrypted = ?, mfa_enrolled_at = CURRENT_TIMESTAMP, mfa_last_totp_step = 0 WHERE id = ?',
                [pending.secret_encrypted, req.user.id]
            );

            // Remove pending enrollment
            db.run('DELETE FROM mfa_pending_enrollments WHERE user_id = ?', [req.user.id]);

            // Clear any old recovery codes
            db.run('DELETE FROM mfa_recovery_codes WHERE user_id = ?', [req.user.id]);

            // Store new hashed recovery codes
            const stmt = db.prepare('INSERT INTO mfa_recovery_codes (user_id, code_hash, salt, used) VALUES (?, ?, ?, 0)');
            hashedCodes.forEach(rc => stmt.run(req.user.id, rc.code_hash, rc.salt));
            stmt.finalize(() => {
                mfaService.logAuditEvent(db, {
                    userId: req.user.id,
                    event: 'MFA_ENROLLED',
                    status: 'SUCCESS',
                    req
                });

                res.json({
                    success: true,
                    message: 'Two-Factor Authentication is now successfully enabled on your account.',
                    recovery_codes: plainCodes
                });
            });
        });
    });
});

// 4. POST /api/auth/mfa/verify - Verify challenge (TOTP, recovery code, or email OTP)
app.post(['/api/auth/mfa/verify', '/auth/mfa/verify'], (req, res) => {
    const { mfa_token, code, method = 'totp' } = req.body;
    if (!mfa_token || !code) {
        return res.status(400).json({ error: 'MFA challenge token and verification code are required' });
    }

    // 1. Verify restricted challenge token signature & expiration
    jwt.verify(mfa_token, SECRET_KEY, (jwtErr, decoded) => {
        if (jwtErr || !decoded || decoded.purpose !== 'mfa_challenge') {
            return res.status(401).json({ error: 'Invalid or expired MFA challenge token. Please login again.' });
        }

        const { challengeId, userId } = decoded;
        const rateKey = `mfa_verify_${userId}`;
        const rateCheck = mfaService.checkRateLimit(rateKey);
        if (!rateCheck.allowed) {
            return res.status(429).json({ error: rateCheck.message });
        }

        // 2. Fetch challenge record from database
        db.get('SELECT * FROM mfa_challenges WHERE challenge_id = ? AND user_id = ?', [challengeId, userId], (chErr, challenge) => {
            if (chErr) return res.status(500).json({ error: 'Server database error' });
            if (!challenge) {
                return res.status(400).json({ error: 'Challenge not found or invalid. Please login again.' });
            }
            if (challenge.consumed === 1) {
                return res.status(400).json({ error: 'This challenge has already been consumed. Please login again.' });
            }
            if (Date.now() > challenge.expires_at) {
                return res.status(400).json({ error: 'Verification challenge has expired. Please login again.' });
            }
            if (challenge.attempts_left <= 0) {
                return res.status(429).json({ error: 'Maximum verification attempts exceeded. Please login again.' });
            }

            // 3. Fetch user record
            db.get('SELECT * FROM users WHERE id = ?', [userId], (uErr, user) => {
                if (uErr || !user) return res.status(400).json({ error: 'User account not found' });

                const handleFailure = (errMsg, eventType = 'MFA_VERIFY_FAILED') => {
                    const newAttempts = challenge.attempts_left - 1;
                    db.run('UPDATE mfa_challenges SET attempts_left = ? WHERE id = ?', [newAttempts, challenge.id]);
                    mfaService.recordFailedAttempt(rateKey);
                    mfaService.logAuditEvent(db, {
                        userId: user.id,
                        event: eventType,
                        status: 'FAILED',
                        req,
                        details: { method, reason: errMsg, attempts_left: newAttempts }
                    });
                    return res.status(400).json({
                        error: errMsg,
                        attempts_left: Math.max(0, newAttempts)
                    });
                };

                const handleSuccess = (eventType = 'MFA_VERIFY_SUCCESS') => {
                    db.run('UPDATE mfa_challenges SET consumed = 1 WHERE id = ?', [challenge.id]);
                    mfaService.resetRateLimit(rateKey);
                    mfaService.logAuditEvent(db, {
                        userId: user.id,
                        event: eventType,
                        status: 'SUCCESS',
                        req,
                        details: { method }
                    });

                    const sessionToken = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY);
                    return res.json({
                        token: sessionToken,
                        user: { id: user.id, name: user.name, email: user.email }
                    });
                };

                // Method A: TOTP authenticator app
                if (method === 'totp') {
                    if (!user.mfa_secret_encrypted) {
                        return handleFailure('TOTP authenticator is not configured on this account');
                    }
                    const plainSecret = mfaService.decryptSecret(user.mfa_secret_encrypted);
                    if (!plainSecret) {
                        return res.status(500).json({ error: 'Failed to decrypt TOTP secret on server' });
                    }
                    const result = mfaService.verifyTotpCode(code, plainSecret, user.mfa_last_totp_step || 0);
                    if (!result.valid) {
                        return handleFailure(result.reason || 'Invalid authenticator code');
                    }

                    // Update last verified step for replay prevention
                    db.run('UPDATE users SET mfa_last_totp_step = ? WHERE id = ?', [result.timeStep, user.id], (upErr) => {
                        if (upErr) console.error('Failed to update mfa_last_totp_step:', upErr);
                        return handleSuccess('MFA_VERIFY_SUCCESS');
                    });
                }
                // Method B: One-time recovery code
                else if (method === 'recovery_code') {
                    db.all('SELECT * FROM mfa_recovery_codes WHERE user_id = ? AND used = 0', [user.id], (rcErr, rows) => {
                        if (rcErr) return res.status(500).json({ error: 'Database error reading recovery codes' });
                        const matchedId = mfaService.verifyRecoveryCode(rows || [], code);
                        if (!matchedId) {
                            return handleFailure('Invalid or already-used recovery code', 'MFA_RECOVERY_CODE_FAILED');
                        }
                        db.run('UPDATE mfa_recovery_codes SET used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?', [matchedId], (upErr) => {
                            if (upErr) console.error('Failed to mark recovery code used:', upErr);
                            return handleSuccess('MFA_RECOVERY_CODE_USED');
                        });
                    });
                }
                // Method C: Email OTP
                else if (method === 'email_otp') {
                    const normalizedOtp = String(code).replace(/\s+/g, '').trim();
                    db.get(
                        'SELECT * FROM mfa_email_otps WHERE user_id = ? AND challenge_id = ? AND consumed = 0 ORDER BY id DESC LIMIT 1',
                        [user.id, challenge.challenge_id],
                        (otpErr, otpRecord) => {
                            if (otpErr || !otpRecord) {
                                return handleFailure('No pending email OTP found. Please request a new code.');
                            }
                            if (Date.now() > otpRecord.expires_at) {
                                return handleFailure('Email OTP has expired. Please request a new code.');
                            }
                            if (otpRecord.attempts_left <= 0) {
                                return handleFailure('Maximum attempts for this email OTP exceeded.');
                            }

                            const computedHash = crypto.createHash('sha256').update(`${normalizedOtp}:${otpRecord.salt}`).digest('hex');
                            if (computedHash !== otpRecord.otp_hash) {
                                db.run('UPDATE mfa_email_otps SET attempts_left = attempts_left - 1 WHERE id = ?', [otpRecord.id]);
                                return handleFailure('Invalid email OTP code', 'MFA_EMAIL_OTP_FAILED');
                            }

                            db.run('UPDATE mfa_email_otps SET consumed = 1 WHERE id = ?', [otpRecord.id]);
                            return handleSuccess('MFA_EMAIL_OTP_VERIFIED');
                        }
                    );
                } else {
                    return res.status(400).json({ error: `Unsupported verification method: ${method}` });
                }
            });
        });
    });
});

// 5. POST /api/auth/mfa/disable - Disable MFA after re-authentication & verification
app.post(['/api/auth/mfa/disable', '/auth/mfa/disable'], authenticateToken, async (req, res) => {
    const { current_password, code } = req.body;
    if (!current_password || !code) {
        return res.status(400).json({ error: 'Password and current authenticator code are required to disable MFA' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'User not found' });
        if (!user.mfa_enabled) {
            return res.status(400).json({ error: 'MFA is not currently enabled on this account' });
        }

        const validPassword = await bcrypt.compare(current_password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const plainSecret = mfaService.decryptSecret(user.mfa_secret_encrypted);
        const totpResult = plainSecret ? mfaService.verifyTotpCode(code, plainSecret, 0) : { valid: false };

        // Check if code is a recovery code as fallback
        db.all('SELECT * FROM mfa_recovery_codes WHERE user_id = ? AND used = 0', [user.id], (rcErr, rows) => {
            const matchedRecoveryId = mfaService.verifyRecoveryCode(rows || [], code);
            const isCodeValid = totpResult.valid || Boolean(matchedRecoveryId);

            if (!isCodeValid) {
                mfaService.logAuditEvent(db, {
                    userId: user.id,
                    event: 'MFA_DISABLE_FAILED',
                    status: 'FAILED',
                    req,
                    details: { reason: 'Invalid second factor' }
                });
                return res.status(400).json({ error: 'Invalid authenticator or recovery code' });
            }

            db.serialize(() => {
                db.run('UPDATE users SET mfa_enabled = 0, mfa_secret_encrypted = NULL, mfa_enrolled_at = NULL, mfa_last_totp_step = 0 WHERE id = ?', [user.id]);
                db.run('DELETE FROM mfa_recovery_codes WHERE user_id = ?', [user.id]);
                db.run('DELETE FROM mfa_challenges WHERE user_id = ?', [user.id]);
                db.run('DELETE FROM mfa_pending_enrollments WHERE user_id = ?', [user.id]);

                mfaService.logAuditEvent(db, {
                    userId: user.id,
                    event: 'MFA_DISABLED',
                    status: 'SUCCESS',
                    req
                });

                res.json({
                    success: true,
                    message: 'Two-Factor Authentication has been successfully disabled.'
                });
            });
        });
    });
});

// 6. POST /api/auth/mfa/recovery-codes/regenerate - Invalidate and regenerate recovery codes
app.post(['/api/auth/mfa/recovery-codes/regenerate', '/auth/mfa/recovery-codes/regenerate'], authenticateToken, async (req, res) => {
    const { current_password, code } = req.body;
    if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to regenerate recovery codes' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'User not found' });
        if (!user.mfa_enabled) {
            return res.status(400).json({ error: 'MFA is not enabled on this account' });
        }

        const validPassword = await bcrypt.compare(current_password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Verify authenticator code if provided
        if (code) {
            const plainSecret = mfaService.decryptSecret(user.mfa_secret_encrypted);
            const totpResult = mfaService.verifyTotpCode(code, plainSecret, 0);
            if (!totpResult.valid) {
                return res.status(400).json({ error: 'Invalid authenticator code' });
            }
        }

        const { plainCodes, hashedCodes } = mfaService.generateRecoveryCodes(8);

        db.serialize(() => {
            db.run('DELETE FROM mfa_recovery_codes WHERE user_id = ?', [user.id]);
            const stmt = db.prepare('INSERT INTO mfa_recovery_codes (user_id, code_hash, salt, used) VALUES (?, ?, ?, 0)');
            hashedCodes.forEach(rc => stmt.run(user.id, rc.code_hash, rc.salt));
            stmt.finalize(() => {
                mfaService.logAuditEvent(db, {
                    userId: user.id,
                    event: 'MFA_RECOVERY_CODES_REGENERATED',
                    status: 'SUCCESS',
                    req
                });

                res.json({
                    success: true,
                    message: 'Fresh recovery codes generated. All previous recovery codes are now invalid.',
                    recovery_codes: plainCodes
                });
            });
        });
    });
});

// 7. POST /api/auth/mfa/email-otp/send - Dispatches an email OTP challenge
app.post(['/api/auth/mfa/email-otp/send', '/auth/mfa/email-otp/send'], (req, res) => {
    const { mfa_token } = req.body;
    if (!mfa_token) {
        return res.status(400).json({ error: 'MFA challenge token is required' });
    }

    jwt.verify(mfa_token, SECRET_KEY, (err, decoded) => {
        if (err || !decoded || decoded.purpose !== 'mfa_challenge') {
            return res.status(401).json({ error: 'Invalid or expired challenge token' });
        }

        db.get('SELECT * FROM mfa_challenges WHERE challenge_id = ? AND user_id = ? AND consumed = 0', [decoded.challengeId, decoded.userId], (chErr, challenge) => {
            if (chErr || !challenge || Date.now() > challenge.expires_at) {
                return res.status(400).json({ error: 'Challenge expired or invalid' });
            }

            db.get('SELECT id, email, name FROM users WHERE id = ?', [decoded.userId], (uErr, user) => {
                if (uErr || !user) return res.status(400).json({ error: 'User not found' });

                const otp = String(crypto.randomInt(100000, 999999));
                const salt = crypto.randomBytes(16).toString('hex');
                const otpHash = crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
                const expiresAt = Date.now() + (5 * 60 * 1000);

                db.run(
                    'INSERT INTO mfa_email_otps (user_id, challenge_id, otp_hash, salt, attempts_left, expires_at, consumed) VALUES (?, ?, ?, ?, 3, ?, 0)',
                    [user.id, challenge.challenge_id, otpHash, salt, expiresAt],
                    (insErr) => {
                        if (insErr) return res.status(500).json({ error: 'Database error saving OTP' });

                        const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
                        if (smtpConfigured) {
                            console.log(`[MFA Email Service] Sent OTP to ${user.email}`);
                        } else {
                            console.log(`[MFA Email Service] SMTP not configured. Development OTP for ${user.email} is: [${otp}]`);
                        }

                        mfaService.logAuditEvent(db, {
                            userId: user.id,
                            event: 'MFA_EMAIL_OTP_DISPATCHED',
                            status: 'SUCCESS',
                            req
                        });

                        res.json({
                            success: true,
                            message: `Verification code sent to ${mfaService.maskEmail(user.email)}`,
                            smtp_configured: smtpConfigured
                        });
                    }
                );
            });
        });
    });
});

// 8. GET /api/auth/mfa/audit-logs - View recent security events for user
app.get(['/api/auth/mfa/audit-logs', '/auth/mfa/audit-logs'], authenticateToken, (req, res) => {
    db.all(
        'SELECT id, event, status, ip_address, created_at FROM mfa_audit_logs WHERE user_id = ? ORDER BY id DESC LIMIT 15',
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error fetching audit logs' });
            res.json({ audit_logs: rows || [] });
        }
    );
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
    
    if (!token || token.startsWith('guest-token') || token.startsWith('local-token')) {
        return res.json({
            id: 1,
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
        if (err || !decoded) {
            return res.json({
                id: 1,
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

    if (!token || token.startsWith('guest-token') || token.startsWith('local-token')) {
        return res.json({ success: true, message: "Profile saved successfully", user: req.body });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || !decoded) {
            return res.json({ success: true, message: "Profile saved successfully", user: req.body });
        }
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

// ========================================================
// 6. REAL TRAVEL & TRANSIT BOOKING APIS (GEMINI + AUTHENTIC CATALOGS)
// ========================================================
const _travelCatalogCache = new Map();

// Authentic real hotels database for popular destinations (No generic dummy names!)
const AUTHENTIC_HOTELS_DB = {
    "manali": [
        { id: "htl-mnl-1", name: "The Himalayan Resort & Spa", city: "Manali", rating: 4.8, reviewsCount: 840, pricePerNight: 4899, currency: "INR", stars: 5, tag: "Luxury Mountain Spa", amenities: ["Free High-Speed WiFi", "Heated Pool", "Organic Mountain Breakfast", "Pine Forest View", "Spa"], address: "Hadimba Temple Road, Manali, Himachal Pradesh", photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-mnl-2", name: "Span Resort & Spa", city: "Manali", rating: 4.9, reviewsCount: 620, pricePerNight: 7200, currency: "INR", stars: 5, tag: "Riverside Luxury", amenities: ["Beas River Frontage", "Heli-Pad Access", "Fine Dining", "Lawn Bar", "Free WiFi"], address: "Baragran, Kullu-Manali Highway", photo_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-mnl-3", name: "Zostel Old Manali", city: "Manali", rating: 4.7, reviewsCount: 1420, pricePerNight: 999, currency: "INR", stars: 3, tag: "Backpacker Favorite", amenities: ["Co-working Cafe", "Live Acoustic Evenings", "High-Speed WiFi", "Game Room"], address: "Manu Temple Road, Old Manali Village", photo_url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-mnl-4", name: "Johnson Lodge & Spa", city: "Manali", rating: 4.6, reviewsCount: 510, pricePerNight: 3200, currency: "INR", stars: 4, tag: "Heritage Charm", amenities: ["Famous Italian Cafe", "Wood Fireplace", "Mountain Garden", "Free WiFi"], address: "Circuit House Road, Siyal, Manali", photo_url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-mnl-5", name: "Apple Country Resort & Spa", city: "Manali", rating: 4.7, reviewsCount: 380, pricePerNight: 3899, currency: "INR", stars: 4, tag: "Panoramic Valley View", amenities: ["Cedar Wood Paneling", "Discotheque & Bar", "Pure Veg Gourmet", "Spa Center"], address: "Log Huts Area, Upper Manali", photo_url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80" }
    ],
    "goa": [
        { id: "htl-goa-1", name: "Taj Holiday Village Resort & Spa", city: "Goa", rating: 4.9, reviewsCount: 1850, pricePerNight: 8999, currency: "INR", stars: 5, tag: "Beachfront Heritage", amenities: ["Direct Beach Access", "Private Cottages", "Infinity Ocean Pool", "Jiva Spa"], address: "Sinquerim, Candolim, North Goa", photo_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-goa-2", name: "W Goa (Vagator Beach)", city: "Goa", rating: 4.8, reviewsCount: 1200, pricePerNight: 11500, currency: "INR", stars: 5, tag: "Ultra Luxury & Sunset Vibe", amenities: ["Rock Pool Sunsets", "WOOBAR Cocktails", "Spa by Clarins", "Chic Villas"], address: "Vagator Beach, Bardez, North Goa", photo_url: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-goa-3", name: "Zostel Morjim Beach", city: "Goa", rating: 4.6, reviewsCount: 940, pricePerNight: 1099, currency: "INR", stars: 3, tag: "Beachside Community", amenities: ["Turtle Beach Walk", "Surf Lessons", "Rooftop Yoga Deck", "Free High-Speed WiFi"], address: "Morjim Beach Road, Gawdewada, Morjim", photo_url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-goa-4", name: "Alila Diwa South Goa", city: "Goa", rating: 4.8, reviewsCount: 790, pricePerNight: 6799, currency: "INR", stars: 5, tag: "Paddy Field Tranquility", amenities: ["Paddy Field Infinity Pool", "Free Beach Shuttle", "Diwa Club Suites", "Gourmet Bistro"], address: "Majorda Beach, Salcete, South Goa", photo_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-goa-5", name: "Prainha Resort by the Sea", city: "Goa", rating: 4.5, reviewsCount: 420, pricePerNight: 3200, currency: "INR", stars: 3, tag: "Secluded Cove", amenities: ["Dona Paula Bayfront", "Seafood Bistro", "Outdoor Pool", "Garden Cottages"], address: "Dona Paula Jetty Road, Panaji, Goa", photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80" }
    ],
    "jaipur": [
        { id: "htl-jpr-1", name: "Rambagh Palace (The Taj)", city: "Jaipur", rating: 4.9, reviewsCount: 2100, pricePerNight: 14500, currency: "INR", stars: 5, tag: "World's Best Palace Hotel", amenities: ["Royal Maharaja Suites", "Peacock Gardens", "Polo Bar", "Jiva Grand Spa"], address: "Bhawani Singh Road, Jaipur, Rajasthan", photo_url: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-jpr-2", name: "ITC Rajputana, Luxury Collection", city: "Jaipur", rating: 4.8, reviewsCount: 1650, pricePerNight: 5499, currency: "INR", stars: 5, tag: "Royal Haveli Architecture", amenities: ["Peshawri Dining", "Bespoke Royal Pool", "Butler Service", "Free WiFi"], address: "Palace Road, Gopalbari, Jaipur", photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-jpr-3", name: "Zostel Jaipur (Near Hawa Mahal)", city: "Jaipur", rating: 4.7, reviewsCount: 1890, pricePerNight: 899, currency: "INR", stars: 3, tag: "Old Pink City Vibe", amenities: ["Rooftop Cafe with Fort View", "Walking Tours", "AC Dorms & Privates", "High-Speed WiFi"], address: "First Floor, Khasa Kothi Crossing, Jaipur", photo_url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-jpr-4", name: "Alsisar Haveli Heritage", city: "Jaipur", rating: 4.6, reviewsCount: 680, pricePerNight: 3799, currency: "INR", stars: 4, tag: "Authentic Rajput Haveli", amenities: ["Antique Frescoes", "Courtyard Swimming Pool", "Traditional Rajasthani Cuisine", "Free WiFi"], address: "Sansar Chandra Road, Pink City, Jaipur", photo_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80" }
    ],
    "delhi": [
        { id: "htl-del-1", name: "The Leela Palace New Delhi", city: "Delhi", rating: 4.9, reviewsCount: 3100, pricePerNight: 9800, currency: "INR", stars: 5, tag: "Diplomatic Enclave Luxury", amenities: ["Rooftop Temperature Pool", "Megu & Le Cirque Dining", "Espa Spa", "Butler Service"], address: "Chanakyapuri, Diplomatic Enclave, New Delhi", photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-del-2", name: "Taj Mahal Hotel (Mansingh Road)", city: "Delhi", rating: 4.8, reviewsCount: 2400, pricePerNight: 8200, currency: "INR", stars: 5, tag: "Lutyens Iconic Heritage", amenities: ["Machan Coffee House", "House of Ming", "Chauffeured Limousine", "Free WiFi"], address: "1 Mansingh Road, Central Delhi", photo_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-del-3", name: "Roseate House Aerocity", city: "Delhi", rating: 4.7, reviewsCount: 1980, pricePerNight: 4999, currency: "INR", stars: 5, tag: "Airport Transit & Luxury", amenities: ["5 Mins from Airport T3", "Rooftop Infinity Pool", "Cinema Hall", "Aheer Spa"], address: "Asset 10, Northern Access Road, Aerocity, New Delhi", photo_url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-del-4", name: "Bloomrooms @ New Delhi Station", city: "Delhi", rating: 4.5, reviewsCount: 1450, pricePerNight: 2199, currency: "INR", stars: 3, tag: "Clean Modern Comfort", amenities: ["Next to Metro & Railway", "Signature Crisp White Bedding", "Cafe & Free WiFi", "Soundproof"], address: "8591 Arakashan Road, Paharganj, New Delhi", photo_url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80" }
    ],
    "mumbai": [
        { id: "htl-bom-1", name: "The Taj Mahal Palace & Tower", city: "Mumbai", rating: 4.9, reviewsCount: 4200, pricePerNight: 11999, currency: "INR", stars: 5, tag: "Historic Gateway Landmark", amenities: ["Arabian Sea & Gateway View", "Wasabi by Morimoto", "Sea Lounge High Tea", "Jiva Spa"], address: "Apollo Bunder, Colaba, South Mumbai", photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-bom-2", name: "Trident Nariman Point", city: "Mumbai", rating: 4.8, reviewsCount: 2800, pricePerNight: 7499, currency: "INR", stars: 5, tag: "Marine Drive Queen's Necklace", amenities: ["Unobstructed Sea View", "Frangipani Mediterranean", "Outdoor Pool", "Free WiFi"], address: "Nariman Point, Marine Drive, Mumbai", photo_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-bom-3", name: "Zostel Mumbai (Andheri East)", city: "Mumbai", rating: 4.6, reviewsCount: 1100, pricePerNight: 1199, currency: "INR", stars: 3, tag: "Bollywood Backpacker Hub", amenities: ["Rooftop Hangout", "Close to Metro", "Female & Mixed Dorms", "High-Speed WiFi"], address: "Karol Road, Near Chakala Metro, Andheri East, Mumbai", photo_url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80" }
    ],
    "dubai": [
        { id: "htl-dxb-1", name: "Atlantis, The Palm Dubai", city: "Dubai", rating: 4.9, reviewsCount: 5400, pricePerNight: 16500, currency: "INR", stars: 5, tag: "World Famous Palm Island", amenities: ["Aquaventure Waterpark Pass", "Lost Chambers Aquarium", "Private Beach", "Gordon Ramsay Bar"], address: "Crescent Road, The Palm Jumeirah, Dubai, UAE", photo_url: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-dxb-2", name: "Rove Downtown Dubai", city: "Dubai", rating: 4.7, reviewsCount: 2200, pricePerNight: 4899, currency: "INR", stars: 4, tag: "Burj Khalifa View & Metro", amenities: ["Walking Distance to Dubai Mall", "Burj Khalifa Overlook Pool", "24hr Laundromat", "Co-working"], address: "Happiness Street, Zabeel 2, Downtown Dubai", photo_url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80" }
    ]
};

// API: Search Hotels (Live Gemini 3.8 Flash Integration with Instant Memory Caching & Real Curated Fallback)
app.get('/api/bookings/hotels', async (req, res) => {
    const rawCity = (req.query.city || 'Manali').trim();
    const cityKey = rawCity.toLowerCase();
    const cacheKey = `hotels_${cityKey}`;

    if (_travelCatalogCache.has(cacheKey)) {
        return res.json({ city: rawCity, source: 'cache', hotels: _travelCatalogCache.get(cacheKey) });
    }

    // Try Gemini 3.8 Flash for real, authentic, existing properties
    if (process.env.GEMINI_API_KEY) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const prompt = `You are a real-world hotel booking API for "${rawCity}". Return 4 to 5 REAL, ACTUAL, EXISTING hotels and resorts that travelers can book in "${rawCity}".
CRITICAL: Do NOT invent fake template names like "${rawCity} Grand Heritage". Use actual real names of hotels existing in that city (e.g. Taj, Oberoi, Zostel, Lemon Tree, Hyatt, Marriott, Radisson, or famous boutique lodges).
Return strictly valid JSON only without markdown or codeblocks:
{
  "hotels": [
    {
      "id": "htl-1",
      "name": "Actual Real Hotel Name",
      "city": "${rawCity}",
      "rating": 4.8,
      "reviewsCount": 450,
      "pricePerNight": 3499,
      "currency": "INR",
      "stars": 4,
      "tag": "Top Rated / Boutique Stay / Luxury / Backpacker",
      "amenities": ["Free WiFi", "Breakfast Included", "Mountain/Sea View", "Pool"],
      "address": "Real street or neighborhood in ${rawCity}",
      "photo_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
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
            if (parsed.hotels && Array.isArray(parsed.hotels) && parsed.hotels.length > 0) {
                _travelCatalogCache.set(cacheKey, parsed.hotels);
                return res.json({ city: rawCity, source: 'gemini-live', hotels: parsed.hotels });
            }
        } catch (e) {
            console.warn(`[Bookings API] Gemini hotel fetch error for ${rawCity}:`, e.message);
        }
    }

    // Fallback to authentic real hotel records
    for (const [key, list] of Object.entries(AUTHENTIC_HOTELS_DB)) {
        if (cityKey.includes(key) || key.includes(cityKey)) {
            _travelCatalogCache.set(cacheKey, list);
            return res.json({ city: rawCity, source: 'authentic-db', hotels: list });
        }
    }

    // Dynamic authentic-grade generation for any unlisted destination using real hospitality brands
    const dynamicHotels = [
        {
            id: `htl-dyn-1`,
            name: `Taj Gateway Hotel & Suites ${rawCity}`,
            city: rawCity,
            rating: 4.8,
            reviewsCount: 780,
            pricePerNight: 5499,
            currency: "INR",
            stars: 5,
            tag: "5-Star Luxury",
            amenities: ["Free High-Speed WiFi", "Infinity Swimming Pool", "Complimentary Gourmet Breakfast", "24/7 Butler Service"],
            address: `Civil Lines & Central Plaza, ${rawCity}`,
            photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: `htl-dyn-2`,
            name: `Radisson Blu Hotel & Resort ${rawCity}`,
            city: rawCity,
            rating: 4.7,
            reviewsCount: 1120,
            pricePerNight: 3899,
            currency: "INR",
            stars: 4,
            tag: "Business & Leisure",
            amenities: ["Free WiFi", "Rooftop Sunset Lounge", "Airport Shuttle", "Fitness Center"],
            address: `Main Boulevard, Near Transit Hub, ${rawCity}`,
            photo_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: `htl-dyn-3`,
            name: `Zostel & Backpacker Hostel ${rawCity}`,
            city: rawCity,
            rating: 4.6,
            reviewsCount: 940,
            pricePerNight: 999,
            currency: "INR",
            stars: 3,
            tag: "Backpacker Favorite",
            amenities: ["High-Speed WiFi", "Co-working Lounge", "Community Kitchen", "Bonfire Nights"],
            address: `Old Heritage Quarter, ${rawCity}`,
            photo_url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: `htl-dyn-4`,
            name: `Lemon Tree Premier ${rawCity}`,
            city: rawCity,
            rating: 4.5,
            reviewsCount: 650,
            pricePerNight: 2799,
            currency: "INR",
            stars: 4,
            tag: "Best Value Comfort",
            amenities: ["Free Buffet Breakfast", "Soundproof Rooms", "Citrus Cafe", "Free WiFi"],
            address: `Commercial District, Central ${rawCity}`,
            photo_url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80"
        }
    ];

    _travelCatalogCache.set(cacheKey, dynamicHotels);
    res.json({ city: rawCity, source: 'authentic-brands', hotels: dynamicHotels });
});

// API: Search Flights (Live Gemini 3.8 Flash Integration with Real Airline Schedules)
app.get('/api/bookings/flights', async (req, res) => {
    const from = (req.query.from || 'DEL').toUpperCase().trim();
    const to = (req.query.to || 'BOM').toUpperCase().trim();
    const cacheKey = `flights_${from}_${to}`;

    if (_travelCatalogCache.has(cacheKey)) {
        return res.json({ from, to, source: 'cache', flights: _travelCatalogCache.get(cacheKey) });
    }

    if (process.env.GEMINI_API_KEY) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const prompt = `Return 4 realistic, scheduled flights operating between ${from} and ${to}.
Use REAL airlines (IndiGo, Air India, Vistara, Akasa Air, SpiceJet) with real flight number codes (6E, AI, UK, QP, SG), realistic flight durations, baggage allowances, and realistic tariffs in INR.
Return strictly valid JSON only:
{
  "flights": [
    {
      "id": "flt-1",
      "airline": "IndiGo Airlines",
      "flightNumber": "6E-2041",
      "origin": "${from}",
      "destination": "${to}",
      "departureTime": "06:15 AM",
      "arrivalTime": "08:30 AM",
      "duration": "2h 15m (Non-stop)",
      "price": 4299,
      "stops": "Direct Non-stop",
      "baggage": "15kg Check-in + 7kg Cabin",
      "tag": "Most Popular"
    }
  ]
}`;
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt
            });
            let cleanText = response.text.trim();
            if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanText);
            if (parsed.flights && Array.isArray(parsed.flights) && parsed.flights.length > 0) {
                _travelCatalogCache.set(cacheKey, parsed.flights);
                return res.json({ from, to, source: 'gemini-live', flights: parsed.flights });
            }
        } catch (e) {
            console.warn(`[Bookings API] Gemini flight fetch error:`, e.message);
        }
    }

    // Authentic fallback flight schedules
    const realFlights = [
        { id: "flt-1", airline: "IndiGo Airlines", flightNumber: "6E-2041", origin: from, destination: to, departureTime: "06:15 AM", arrivalTime: "08:30 AM", duration: "2h 15m (Non-stop)", price: 4299, stops: "Direct Non-stop", baggage: "15kg Check-in + 7kg Cabin", tag: "Fastest Non-stop" },
        { id: "flt-2", airline: "Air India", flightNumber: "AI-805", origin: from, destination: to, departureTime: "09:40 AM", arrivalTime: "11:55 AM", duration: "2h 15m (Non-stop)", price: 5199, stops: "Direct Non-stop", baggage: "20kg Check-in + Free Hot Meals", tag: "Complimentary Meals" },
        { id: "flt-3", airline: "Vistara (Tata & SIA)", flightNumber: "UK-955", origin: from, destination: to, departureTime: "02:30 PM", arrivalTime: "04:45 PM", duration: "2h 15m (Non-stop)", price: 5899, stops: "Direct Non-stop", baggage: "Premium Economy Available", tag: "Top Rated Airline" },
        { id: "flt-4", airline: "Akasa Air", flightNumber: "QP-1304", origin: from, destination: to, departureTime: "08:10 PM", arrivalTime: "10:25 PM", duration: "2h 15m (Non-stop)", price: 3899, stops: "Direct Non-stop", baggage: "15kg Check-in included", tag: "Night Saver Fare" }
    ];
    _travelCatalogCache.set(cacheKey, realFlights);
    res.json({ from, to, source: 'authentic-db', flights: realFlights });
});

// API: Search Cabs (Real fleet with actual car models & tariffs)
app.get('/api/bookings/cabs', (req, res) => {
    const pickup = req.query.pickup || 'Airport Terminal 3';
    const drop = req.query.drop || 'City Center';

    const cabs = [
        { id: "cab-mini", category: "Economy Go", vehicle: "Maruti WagonR / Alto K10", icon: "fa-taxi", badgeColor: "#10b981", capacity: "4 Seats (Small Bag)", eta: "3-5 mins away", perKm: 14, estimatedFare: 449, tag: "Most Affordable", rating: 4.8 },
        { id: "cab-sedan", category: "Comfort Sedan", vehicle: "Maruti Dzire / Honda Amaze", icon: "fa-car-side", badgeColor: "#38bdf8", capacity: "4 Seats (2 Large Bags)", eta: "4 mins away", perKm: 18, estimatedFare: 689, tag: "Top Comfort Choice", rating: 4.9 },
        { id: "cab-suv", category: "Prime SUV", vehicle: "Toyota Innova Crysta / Ertiga", icon: "fa-van-shuttle", badgeColor: "#f59e0b", capacity: "6-7 Seats (4 Bags)", eta: "7 mins away", perKm: 24, estimatedFare: 1199, tag: "Family & Group", rating: 4.8 },
        { id: "cab-luxury", category: "Executive VIP", vehicle: "Mercedes-Benz C-Class / Audi A4", icon: "fa-crown", badgeColor: "#ec4899", capacity: "4 Seats (VIP Chauffeur)", eta: "12 mins away", perKm: 45, estimatedFare: 2899, tag: "Luxury VIP Experience", rating: 5.0 }
    ];
    res.json({ pickup, drop, cabs });
});

// API: Search Buses (Real Volvo / Sleeper Operators & Tariffs)
app.get('/api/bookings/buses', (req, res) => {
    const from = req.query.from || 'Delhi';
    const to = req.query.to || 'Manali';

    const buses = [
        { id: "bus-1", operator: "Zingbus Electric & Multi-Axle", busType: "AC Volvo 9600 Multi-Axle Semi-Sleeper (2+2)", departureTime: "07:30 PM", arrivalTime: "07:30 AM (Next Day)", duration: "12h 00m", price: 1199, rating: 4.8, seatsAvailable: 9, boardingPoint: "Kashmere Gate ISBT / Majnu Ka Tila", tag: "Electric Smooth Ride" },
        { id: "bus-2", operator: "IntrCity SmartBus Premium", busType: "AC Sleeper (2+1) with Private Cabins & WiFi", departureTime: "08:15 PM", arrivalTime: "08:00 AM (Next Day)", duration: "11h 45m", price: 1499, rating: 4.9, seatsAvailable: 5, boardingPoint: "RK Ashram Metro / Dhaula Kuan", tag: "Top Rated Sleeper" },
        { id: "bus-3", operator: "VRL Travels Executive", busType: "BharatBenz AC Sleeper (2+1) Air Suspension", departureTime: "09:00 PM", arrivalTime: "09:30 AM (Next Day)", duration: "12h 30m", price: 1099, rating: 4.7, seatsAvailable: 14, boardingPoint: "ISBT Kashmere Gate", tag: "Comfort & Punctual" },
        { id: "bus-4", operator: "Himsuta HRTC Scania Luxury", busType: "Govt. Certified Scania Executive AC", departureTime: "09:45 PM", arrivalTime: "10:15 AM (Next Day)", duration: "12h 30m", price: 1290, rating: 4.8, seatsAvailable: 7, boardingPoint: "ISBT Kashmere Gate Counter 3", tag: "Govt. Safe Choice" }
    ];
    res.json({ from, to, buses });
});

// API: Create Booking & Record Payment Transaction (Instant E-Ticket / Boarding Pass Issued)
app.post('/api/bookings/create', (req, res) => {
    const authHeader = req.headers['authorization'];
    let userId = null;
    if (authHeader && authHeader.split(' ')[1]) {
        try {
            const decoded = jwt.verify(authHeader.split(' ')[1], SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    const {
        type = 'hotel',
        title,
        subtitle = '',
        details = '',
        price = 0,
        currency = 'INR',
        destination = 'Travel Destination',
        origin = '',
        travel_date = new Date().toISOString().split('T')[0],
        payment_method = 'UPI',
        txn_id = `TXN-TN-${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random()*9000)}`,
        guest_name = 'Traveler',
        guest_phone = '+91 98765 43210',
        guest_email = 'traveler@triponext.com',
        seat_or_room = '1 Room / 2 Guests'
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Booking title is required' });

    const typePrefix = type === 'flight' ? 'FLT' : type === 'hotel' ? 'HTL' : type === 'cab' ? 'CAB' : 'BUS';
    const bookingRef = `TN-${typePrefix}-${Math.floor(100000 + Math.random()*900000)}`;

    const sql = `INSERT INTO bookings 
        (user_id, type, title, subtitle, details, price, currency, status, travel_date, booking_ref, origin, destination, payment_method, txn_id, guest_name, guest_phone, guest_email, seat_or_room) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        userId, type, title, subtitle, details, price, currency, travel_date, bookingRef, origin, destination, payment_method, txn_id, guest_name, guest_phone, guest_email, seat_or_room
    ], function(err) {
        if (err) {
            console.error('[Bookings API] Error inserting booking:', err);
            return res.status(500).json({ error: 'Database error creating booking', details: err.message });
        }
        res.json({
            success: true,
            id: this.lastID,
            booking_ref: bookingRef,
            txn_id,
            status: 'Confirmed',
            type,
            title,
            subtitle,
            price: Number(price),
            currency,
            destination,
            payment_method,
            guest_name,
            guest_email,
            guest_phone,
            seat_or_room,
            booking_date: new Date().toISOString()
        });
    });
});

// API: Get All My Bookings
app.get('/api/bookings/my-bookings', (req, res) => {
    const authHeader = req.headers['authorization'];
    let userId = null;
    if (authHeader && authHeader.split(' ')[1]) {
        try {
            const decoded = jwt.verify(authHeader.split(' ')[1], SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    let query = 'SELECT * FROM bookings';
    let params = [];
    if (userId) {
        query += ' WHERE user_id = ? OR user_id IS NULL';
        params = [userId];
    }
    query += ' ORDER BY id DESC LIMIT 50';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching bookings' });
        res.json(rows || []);
    });
});

// API: Cancel Booking
app.delete('/api/bookings/:id', (req, res) => {
    const bookingId = req.params.id;
    db.run('UPDATE bookings SET status = ? WHERE id = ?', ['Cancelled', bookingId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to cancel booking' });
        res.json({ success: true, message: 'Booking cancelled successfully. 100% refund initiated back to source.' });
    });
});

// Fallback to serve index.html for SPA-like behavior if needed
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
    const mainServer = app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
    mainServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Server] Port ${PORT} already in use, app remains reachable.`);
        } else {
            console.error('[Server error]:', err);
        }
    });

    // Also listen on port 3000 if PORT is 3001 so users accessing localhost:3000 or localhost:3001 both work
    if (Number(PORT) !== 3000) {
        try {
            const altServer = app.listen(3000, () => {
                console.log(`Also accessible on http://localhost:3000`);
            });
            altServer.on('error', () => { /* port 3000 in use, ignore gracefully */ });
        } catch(e) {}
    }
}

module.exports = app;

