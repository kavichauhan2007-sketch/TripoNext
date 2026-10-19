// TripoNext Firebase Cloud Firestore Database Service
// Replaces SQLite with production Firebase Cloud Firestore

const admin = require('firebase-admin');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let firestoreInstance = null;
let isLiveFirestore = false;

// In-memory fallback cache for when serviceAccountKey is pending
const _localFallbackStore = {
    users: new Map(),
    trips: new Map(),
    bookings: new Map(),
    notifications: new Map(),
    posts: new Map(),
    hidden_gems: new Map(),
    buddy_messages: new Map(),
    trip_photos: new Map(),
    trip_expenses: new Map(),
    feedback_reviews: new Map(),
    support_tickets: new Map(),
    mfa_challenges: new Map(),
    mfa_recovery_codes: new Map(),
    mfa_audit_logs: new Map(),
    mfa_pending_enrollments: new Map(),
    mfa_email_otps: new Map()
};

let _idCounter = 1000;

function generateId() {
    return crypto.randomUUID();
}

/**
 * Initialize Firebase Admin with Firestore
 */
function initFirebase() {
    const existingApps = getApps();
    if (existingApps.length > 0) {
        firestoreInstance = getFirestore(existingApps[0]);
        return firestoreInstance;
    }

    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
        ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        : path.resolve(__dirname, 'serviceAccountKey.json');

    if (fs.existsSync(keyPath)) {
        try {
            const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            const app = initializeApp({
                credential: cert(serviceAccount)
            });
            firestoreInstance = getFirestore(app);
            isLiveFirestore = true;
            console.log(`[Firebase] Successfully connected to Cloud Firestore (Project: ${serviceAccount.project_id || 'active'}) via serviceAccountKey.json.`);
            return firestoreInstance;
        } catch (e) {
            console.error('[Firebase] Error reading serviceAccountKey.json:', e.message);
        }
    }

    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        try {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
            const app = initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey
                })
            });
            firestoreInstance = getFirestore(app);
            isLiveFirestore = true;
            console.log(`[Firebase] Successfully connected to Cloud Firestore (Project: ${process.env.FIREBASE_PROJECT_ID}) via environment variables.`);
            return firestoreInstance;
        } catch (e) {
            console.error('[Firebase] Error initializing Firebase with env vars:', e.message);
        }
    }

    // Default configuration mode with clear logging
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID || 'triponext-travel-app';
        const app = initializeApp({ projectId });
        firestoreInstance = getFirestore(app);
        console.log(`[Firebase] Initialized with Project ID: ${projectId}.`);
        console.log(`[Firebase] To connect your live cloud database, place serviceAccountKey.json in the project root.`);
        return firestoreInstance;
    } catch (e) {
        console.warn('[Firebase] Fallback mode active:', e.message);
    }
}

initFirebase();

/**
 * Generic Firestore collection accessor & repository methods
 */
const dbService = {
    admin,
    getFirestore: () => firestoreInstance,
    isLive: () => isLiveFirestore,

    /**
     * Get document by ID
     */
    async get(collectionName, id) {
        const stringId = String(id);
        if (isLiveFirestore && firestoreInstance) {
            try {
                const doc = await firestoreInstance.collection(collectionName).doc(stringId).get();
                if (doc.exists) {
                    return { id: doc.id, ...doc.data() };
                }
                return null;
            } catch (e) {
                console.warn(`[Firestore get ${collectionName}] error:`, e.message);
            }
        }
        const collection = _localFallbackStore[collectionName];
        if (collection && collection.has(stringId)) {
            return { id: stringId, ...collection.get(stringId) };
        }
        return null;
    },

    /**
     * Query documents with simple filters
     * @param {string} collectionName
     * @param {Array<{ field: string, op: string, value: any }>} conditions
     * @param {{ orderBy?: string, orderDir?: 'asc'|'desc', limit?: number }} options
     */
    async find(collectionName, conditions = [], options = {}) {
        if (isLiveFirestore && firestoreInstance) {
            try {
                let query = firestoreInstance.collection(collectionName);
                for (const cond of conditions) {
                    query = query.where(cond.field, cond.op, cond.value);
                }
                if (options.orderBy) {
                    query = query.orderBy(options.orderBy, options.orderDir || 'asc');
                }
                if (options.limit) {
                    query = query.limit(options.limit);
                }
                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.warn(`[Firestore find ${collectionName}] error:`, e.message);
            }
        }

        // Local fallback querying
        const collection = _localFallbackStore[collectionName] || new Map();
        let results = [];
        for (const [id, data] of collection.entries()) {
            let matches = true;
            for (const cond of conditions) {
                const val = data[cond.field];
                if (cond.op === '==') {
                    if (val != cond.value) matches = false;
                } else if (cond.op === '!=') {
                    if (val == cond.value) matches = false;
                } else if (cond.op === '>') {
                    if (!(val > cond.value)) matches = false;
                } else if (cond.op === '>=') {
                    if (!(val >= cond.value)) matches = false;
                } else if (cond.op === '<') {
                    if (!(val < cond.value)) matches = false;
                } else if (cond.op === '<=') {
                    if (!(val <= cond.value)) matches = false;
                }
                if (!matches) break;
            }
            if (matches) {
                results.push({ id, ...data });
            }
        }

        if (options.orderBy) {
            const field = options.orderBy;
            const dir = options.orderDir === 'desc' ? -1 : 1;
            results.sort((a, b) => {
                if (a[field] < b[field]) return -1 * dir;
                if (a[field] > b[field]) return 1 * dir;
                return 0;
            });
        }

        if (options.limit && options.limit > 0) {
            results = results.slice(0, options.limit);
        }

        return results;
    },

    /**
     * Find a single document matching conditions
     */
    async findOne(collectionName, conditions = []) {
        const results = await this.find(collectionName, conditions, { limit: 1 });
        return results.length > 0 ? results[0] : null;
    },

    /**
     * Insert a new document with an auto-generated or custom ID
     */
    async insert(collectionName, data, customId = null) {
        const id = customId ? String(customId) : generateId();
        const record = {
            ...data,
            created_at: data.created_at || new Date().toISOString()
        };

        if (isLiveFirestore && firestoreInstance) {
            try {
                await firestoreInstance.collection(collectionName).doc(id).set(record);
                return { id, ...record };
            } catch (e) {
                console.warn(`[Firestore insert ${collectionName}] error:`, e.message);
            }
        }

        if (!_localFallbackStore[collectionName]) {
            _localFallbackStore[collectionName] = new Map();
        }
        _localFallbackStore[collectionName].set(id, record);
        return { id, ...record };
    },

    /**
     * Update an existing document by ID
     */
    async update(collectionName, id, updateData) {
        const stringId = String(id);
        const updates = {
            ...updateData,
            updated_at: new Date().toISOString()
        };

        if (isLiveFirestore && firestoreInstance) {
            try {
                await firestoreInstance.collection(collectionName).doc(stringId).update(updates);
                const updated = await this.get(collectionName, stringId);
                return updated;
            } catch (e) {
                console.warn(`[Firestore update ${collectionName}] error:`, e.message);
            }
        }

        const collection = _localFallbackStore[collectionName];
        if (collection && collection.has(stringId)) {
            const existing = collection.get(stringId);
            const merged = { ...existing, ...updates };
            collection.set(stringId, merged);
            return { id: stringId, ...merged };
        }
        return null;
    },

    /**
     * Delete document by ID
     */
    async delete(collectionName, id) {
        const stringId = String(id);
        if (isLiveFirestore && firestoreInstance) {
            try {
                await firestoreInstance.collection(collectionName).doc(stringId).delete();
                return true;
            } catch (e) {
                console.warn(`[Firestore delete ${collectionName}] error:`, e.message);
            }
        }

        const collection = _localFallbackStore[collectionName];
        if (collection) {
            return collection.delete(stringId);
        }
        return false;
    },

    /**
     * Count documents matching conditions
     */
    async count(collectionName, conditions = []) {
        const items = await this.find(collectionName, conditions);
        return items.length;
    }
};

/**
 * Seed initial sample datasets into Firestore if empty
 */
async function seedInitialFirestoreData() {
    try {
        const gemsCount = await dbService.count('hidden_gems');
        if (gemsCount === 0) {
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
                }
            ];
            for (const gem of seedGems) {
                await dbService.insert('hidden_gems', gem);
            }
            console.log('[Firebase Firestore] Seeded initial Hidden Gems collection.');
        }

        const notifsCount = await dbService.count('notifications');
        if (notifsCount === 0) {
            const seedNotifs = [
                { title: "Buddy Request Accepted 🎉", message: "Rahul S. accepted your join request for the Manali Roadtrip! Say hi in chat.", type: "buddy", is_read: 0 },
                { title: "Weather Update ☀️", message: "Sunny skies and clear weather expected for your upcoming trip.", type: "weather", is_read: 0 },
                { title: "Expense Splitter Active 💸", message: "Keep track of who paid what during your adventures with the new Expense Splitter in My Trips.", type: "system", is_read: 0 }
            ];
            for (const notif of seedNotifs) {
                await dbService.insert('notifications', notif);
            }
            console.log('[Firebase Firestore] Seeded initial Notifications collection.');
        }

        const photosCount = await dbService.count('trip_photos');
        if (photosCount === 0) {
            const seedPhotos = [
                { author_name: "Amit K.", destination: "Jaipur, India", caption: "Pink City sunset from the secret fort ridge. Unmatched vibes!", photo_url: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80", likes: 42 },
                { author_name: "Pooja V.", destination: "Kyoto, Japan", caption: "Early morning serenity in Arashiyama bamboo path before crowds arrived 🎋", photo_url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80", likes: 58 },
                { author_name: "Sneha M.", destination: "Paris, France", caption: "Croissant & coffee near Montmartre secret vineyard alley ☕✨", photo_url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80", likes: 37 }
            ];
            for (const photo of seedPhotos) {
                await dbService.insert('trip_photos', photo);
            }
            console.log('[Firebase Firestore] Seeded initial Trip Photos collection.');
        }

        const messagesCount = await dbService.count('buddy_messages');
        if (messagesCount === 0) {
            const seedMessages = [
                { sender_id: "1", sender_name: "Rahul S.", receiver_name: "You", trip_destination: "Manali, Himachal", message: "Hey! Super excited for the Manali road trip. We're planning to stop by Solang Valley and Sissu waterfall." },
                { sender_id: "2", sender_name: "Ananya D.", receiver_name: "You", trip_destination: "Gokarna, Karnataka", message: "Hi buddy! Kudle beach hostel is booked. Don't forget your trekking shoes for the beach trail!" }
            ];
            for (const msg of seedMessages) {
                await dbService.insert('buddy_messages', msg);
            }
            console.log('[Firebase Firestore] Seeded initial Buddy Messages collection.');
        }

        // Seed demo 2FA account
        const existingDemo = await dbService.findOne('users', [{ field: 'email', op: '==', value: 'demo2fa@triponext.com' }]);
        if (!existingDemo) {
            const bcrypt = require('bcryptjs');
            const mfaService = require('./mfaService');
            const hashedPassword = await bcrypt.hash('Password123!', 10);
            const secret = mfaService.generateTotpSecret();
            const encryptedSecret = mfaService.encryptSecret(secret);
            const demoUser = await dbService.insert('users', {
                name: 'TripoNext 2FA Demo',
                email: 'demo2fa@triponext.com',
                password: hashedPassword,
                mfa_enabled: '1',
                mfa_secret_encrypted: encryptedSecret,
                mfa_enrolled_at: new Date().toISOString(),
                mfa_last_totp_step: 0
            }, '12');

            const { plainCodes, hashedCodes } = mfaService.generateRecoveryCodes(8);
            for (const item of hashedCodes) {
                await dbService.insert('mfa_recovery_codes', {
                    user_id: String(demoUser.id),
                    code_hash: item.code_hash,
                    salt: item.salt,
                    used: 0
                });
            }
            console.log('[Firebase Firestore] Seeded demo2fa@triponext.com account with 2FA enabled.');
        }
    } catch (e) {
        console.warn('[Firebase Firestore] Seeding notice:', e.message);
    }
}

// Run initial seeding in background
setTimeout(seedInitialFirestoreData, 500);

module.exports = dbService;

