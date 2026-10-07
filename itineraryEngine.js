/**
 * TripoNext Smart Itinerary Engine
 * Generates rich, authentic, human-curated itineraries with real locations,
 * local food spots, insider tips, and realistic budget allocations.
 */

const CURATED_DESTINATIONS = {
    goa: {
        vibe: "Tropical Beach & Portuguese Heritage",
        summary: "A vibrant coastal escape featuring golden beaches, secret cliff viewpoints, authentic Goan fish curry thalis, and colorful Latin quarter heritage walks.",
        packingList: ["Quick-dry beachwear & swimwear", "SPF 50+ reef-safe sunscreen", "Polarized sunglasses", "Breathable linen shirts & flip-flops", "Waterproof dry bag for boat rides"],
        insiderTips: [
            "Rent a scooty near your hotel for ₹350 - ₹450/day; it is the most convenient way to explore Goa.",
            "Avoid peak taxi rates by asking your hotel to arrange local contacts or using GoaMiles app.",
            "Try local feni or freshly tapped coconut toddy at quaint neighborhood taverns in Fontainhas."
        ],
        days: [
            {
                day: 1,
                theme: "North Goa Coast, Sunset Cliffs & Seafood Feast",
                morning: { time: "09:00 AM", act: "Aguada Fort & Historic Portuguese Lighthouse Walk", loc: "Sinquerim / Candolim Coast", tip: "Reach before 10 AM to avoid mid-day sun and capture panoramic Arabian Sea views." },
                afternoon: { time: "01:30 PM", act: "Authentic Goan Fish Curry Thali & Bebinca", loc: "Ritz Classic or Martin's Corner", tip: "Ask for Kingfish / Surmai rawa fry with traditional red rice." },
                evening: { time: "06:00 PM", act: "Sunset Cocktails at Cliffside Greek Lounge & Night Market", loc: "Thalassa Lounge, Vagator / Anjuna", tip: "Pre-book a sunset edge table 30 mins before 6 PM for magical golden rays." }
            },
            {
                day: 2,
                theme: "Latin Quarter Heritage & Old Goa History",
                morning: { time: "08:30 AM", act: "UNESCO Basilica of Bom Jesus & Se Cathedral Tour", loc: "Old Goa (Velha Goa)", tip: "Dress modestly covering shoulders and knees; 400-year-old baroque architecture is breathtaking." },
                afternoon: { time: "01:00 PM", act: "Colorful Heritage Photography Walk in Fontainhas", loc: "Panjim Latin Quarter", tip: "Try artisanal coffee and fresh poee bread at Viva Panjim or Caravela Café." },
                evening: { time: "06:30 PM", act: "Mandovi River Sunset Cruise with Folk Dance", loc: "Panjim Jetty Promenade", tip: "Book the 1-hour sunset cruise with live Konkani music and Goan folk performance." }
            },
            {
                day: 3,
                theme: "South Goa Serenity & Crescent Bay Kayaking",
                morning: { time: "08:00 AM", act: "Scenic Drive to Cabo de Rama Cliff Viewpoint", loc: "Cabo de Rama Fort, Canacona", tip: "Uncrowded dramatic ocean drop-off; bring drinking water as there are no big shops." },
                afternoon: { time: "01:30 PM", act: "Seafront Lunch & Crescent Bay Kayaking", loc: "Palolem Beach & Dropadi Shack", tip: "Rent a double kayak for ₹300/hour to explore quiet rocky bays." },
                evening: { time: "06:30 PM", act: "Sunset Stroll & Candlelit Dining under Palms", loc: "Agonda Beach", tip: "Agonda is peaceful and turtle-nesting friendly; zero loud parties, pure serene vibes." }
            },
            {
                day: 4,
                theme: "Jungle Waterfalls & Aromatic Spice Plantations",
                morning: { time: "07:30 AM", act: "4x4 Jeep Safari to Majestic Dudhsagar Falls", loc: "Mollem National Park", tip: "Life jackets are mandatory for swimming in the cool emerald plunge pool." },
                afternoon: { time: "01:30 PM", act: "Organic Spice Garden Tour & Buffet Lunch on Banana Leaves", loc: "Sahakari Spice Farm, Ponda", tip: "Enjoy traditional cashew feni welcome drink and fresh aromatic herbal teas." },
                evening: { time: "07:00 PM", act: "Souvenir Shopping & Live Acoustic Night", loc: "Calangute - Baga Promenade", tip: "Pick up authentic Goan cashews, Kokum syrup, and handmade shell souvenirs." }
            }
        ]
    },
    manali: {
        vibe: "Snowy Alpine & Bohemian Mountain Charm",
        summary: "A thrilling Himalayan journey featuring ancient deodar pine forests, gushing river rapids, cozy bohemian cafés, and high-altitude mountain passes.",
        packingList: ["Warm thermal innerwear & windproof fleece jacket", "Sturdy waterproof hiking shoes", "Woolen cap, gloves & neck gaiter", "UV sunglasses for snow glare", "Moisturizing lip balm & cold cream"],
        insiderTips: [
            "Always keep cash handy as mobile network and UPI can be patchy around high mountain passes.",
            "Book Atal Tunnel / Rohtang permits a day in advance through your local homestay or verified driver.",
            "Try authentic Himachali Siddu (steamed stuffed wheat bread) served with hot desi ghee."
        ],
        days: [
            {
                day: 1,
                theme: "Old Manali Bohemian Vibes & Pine Forests",
                morning: { time: "09:00 AM", act: "Hidimba Devi Temple & Ancient Pine Forest Walk", loc: "Dhungri Van Vihar", tip: "Wooden tiered architecture built in 1553; spot friendly Himalayan rabbits for photos." },
                afternoon: { time: "01:30 PM", act: "Wood-fired Pizza & Ginger Lemon Tea by River Rapids", loc: "Café 1947, Old Manali", tip: "Sit on the riverside wooden deck overlooking gushing clear stream waters." },
                evening: { time: "06:00 PM", act: "Mall Road Stroll, Hot Steamed Momos & Woolen Shopping", loc: "The Mall, Manali", tip: "Buy certified Kullu handwoven shawls and dried Himalayan apricots." }
            },
            {
                day: 2,
                theme: "Engineering Marvel: Atal Tunnel & Sissu Snow Valley",
                morning: { time: "08:00 AM", act: "Scenic Drive through the 9.02 km Atal Tunnel", loc: "Rohtang Highway to Lahaul", tip: "Watch the landscape dramatically change from lush pine green to barren snow peaks." },
                afternoon: { time: "01:00 PM", act: "Hike to the Frozen Sissu Waterfall & Riverside Maggi", loc: "Sissu, Lahaul Valley", tip: "Zip-lining over the glacial river is available here for ₹500 - ₹800." },
                evening: { time: "06:00 PM", act: "Solang Valley Snow Point Fun & Paragliding Viewpoints", loc: "Solang Valley", tip: "Try ATV quad biking through muddy snow trails." }
            },
            {
                day: 3,
                theme: "Jogini Waterfall Trek & Sulphur Springs",
                morning: { time: "08:30 AM", act: "Scenic 3 km Apple Orchard Trek to Jogini Falls", loc: "Vashisht Village Trail", tip: "Carry a small water bottle; the top cascade offers peaceful misty spray." },
                afternoon: { time: "01:30 PM", act: "Relaxing Natural Sulphur Hot Spring Bath & Hot Siddu Lunch", loc: "Vashisht Temple Baths", tip: "The natural warm mineral water relieves muscle fatigue from mountain walks." },
                evening: { time: "06:30 PM", act: "Acoustic Live Music & Fresh Cinnamon Cookies", loc: "Dylan's Toasted & Roasted Café", tip: "Cozy legendary backpacker spot famous for fresh chocolate cookies." }
            },
            {
                day: 4,
                theme: "Naggar Castle Heritage & River Trout",
                morning: { time: "09:30 AM", act: "Medieval Himalayan Wood & Stone Architecture Tour", loc: "Naggar Castle & Roerich Art Gallery", tip: "Stunning 180-degree Beas valley vistas; shot in several Bollywood movies." },
                afternoon: { time: "01:30 PM", act: "Fresh River Trout Fish Tasting & Apple Crumble", loc: "Naggar Village Heritage Eatery", tip: "Locally farmed Beas trout prepared in garlic herb butter." },
                evening: { time: "06:30 PM", act: "Sunset Campfire & Himalayan Stargazing", loc: "Riverside Camp / Homestay", tip: "Crisp mountain night air with clear views of the Milky Way." }
            }
        ]
    },
    jaipur: {
        vibe: "Royal Heritage & Vibrant Rajasthani Splendor",
        summary: "A grand royal expedition across the Pink City with majestic hilltop forts, vibrant artisan bazaars, regal palaces, and legendary Rajasthani delicacies.",
        packingList: ["Comfortable flat walking shoes for stone fort ramps", "Cotton breathable clothing", "Sun hat or scarf for palace courtyards", "Portable power bank for nonstop photo sessions", "Hand sanitizer & wet wipes"],
        insiderTips: [
            "Buy a composite ticket at the first monument to save 50% on entry queues across Amer, Hawa Mahal, and Albert Hall.",
            "Visit Nahargarh Fort around 5:15 PM for the most breathtaking sunset over the entire illuminated city.",
            "Hire registered heritage audio guides instead of unofficial tour guides."
        ],
        days: [
            {
                day: 1,
                theme: "Pink City Landmarks & Street Gastronomy",
                morning: { time: "08:30 AM", act: "Sunrise Photography from Wind View Café opposite Hawa Mahal", loc: "Badi Chaupar, Old Jaipur", tip: "Early morning sunlight hits the 953 honeycomb casements perfectly." },
                afternoon: { time: "01:00 PM", act: "City Palace Royal Courtyards & Peacock Gate", loc: "City Palace Complex", tip: "The intricate colored glass and peacock feather motifs make incredible portraits." },
                evening: { time: "06:00 PM", act: "Legendary Pyaaz Kachori & Makhaniya Lassi Feast", loc: "Rawat Mishthan Bhandar", tip: "Crispy piping-hot onion kachori served with sweet tamarind chutney." }
            },
            {
                day: 2,
                theme: "Majestic Amer Fort & Sunset Ridge",
                morning: { time: "08:30 AM", act: "Amer Fort Exploration & Sheesh Mahal (Mirror Palace)", loc: "Amer Fort Hilltop", tip: "A single candle light reflects across thousands of convex Belgian mirrors." },
                afternoon: { time: "01:30 PM", act: "Panna Meena Ka Kund Stepwell & Royal Lunch", loc: "Amer Heritage Quarter", tip: "Geometric symmetrical steps make for world-famous architectural photography." },
                evening: { time: "05:30 PM", act: "Nahargarh Fort Sunset Ledge & Lit-up City Vistas", loc: "Nahargarh Fort Ridge", tip: "Watch the entire pink city light up like golden embers beneath you." }
            },
            {
                day: 3,
                theme: "Bazaars, Art & Night Palace Illumination",
                morning: { time: "09:30 AM", act: "Albert Hall Museum & Royal Weaponry Gallery", loc: "Ram Niwas Garden", tip: "Feed the friendly pigeons in the grand open museum plaza." },
                afternoon: { time: "01:30 PM", act: "Johari & Bapu Bazaar Blue Pottery & Bandhani Shopping", loc: "Old City Bazaars", tip: "Politely bargain with shopkeepers; check for authentic block-print textiles." },
                evening: { time: "06:30 PM", act: "Rooftop Chai & Hand-cut Nachos at Tapri Central", loc: "Tapri Central, C-Scheme", tip: "Trendy rooftop overlooking Central Park with artisanal chai served in cutting glasses." }
            }
        ]
    },
    paris: {
        vibe: "Haussmann Elegance & Bohemian Romance",
        summary: "A timeless journey through romantic Parisian boulevards, world-class art collections, hidden hilltop bistros, and golden hour river views.",
        packingList: ["Stylish yet comfortable all-day walking sneakers", "Chic trench coat or layer", "Universal European 2-pin power adapter", "Crossbody anti-theft bag for metro rides", "Offline city metro navigation app"],
        insiderTips: [
            "Use the Navigo Easy pass or contactless card on the Paris Metro to move around effortlessly.",
            "Book Louvre Museum tickets online with designated morning time slots to skip 2-hour queue lines.",
            "Water in Parisian restaurants is free by asking for 'une carafe d'eau'."
        ],
        days: [
            {
                day: 1,
                theme: "Eiffel Tower Golden Hour & Seine River Cruise",
                morning: { time: "08:30 AM", act: "Sunrise Photography from Place du Trocadéro", loc: "Trocadéro Esplanade", tip: "Beat tourist crowds before 9 AM for unobstructed Eiffel Tower views." },
                afternoon: { time: "01:30 PM", act: "Scenic 1-Hour Seine River Boat Cruise", loc: "Pont de l'Alma / Bateaux-Mouches", tip: "Glides past Notre-Dame, Musée d'Orsay, and historic stone river bridges." },
                evening: { time: "06:30 PM", act: "Montmartre Cobblestone Walk & Classic Steak-Frites Dinner", loc: "Sacré-Cœur & Le Relais de l'Entrecôte", tip: "Watch street musicians on the steps of Sacré-Cœur with panoramic city views." }
            },
            {
                day: 2,
                theme: "World Art, Tuileries Gardens & Arc de Triomphe",
                morning: { time: "09:00 AM", act: "The Louvre Museum Treasures", loc: "Cour Napoléon Glass Pyramid", tip: "Enter via the underground Carrousel shopping mall entrance to skip outdoor queues." },
                afternoon: { time: "01:30 PM", act: "Stroll through Jardin des Tuileries & Angelina Hot Chocolate", loc: "Rue de Rivoli", tip: "Order the famous thick African hot chocolate and Mont-Blanc pastry." },
                evening: { time: "06:00 PM", act: "Arc de Triomphe Rooftop Golden Hour & Champs-Élysées Walk", loc: "Place Charles de Gaulle", tip: "Climb the 284 steps for 12 radiating grand avenue sunset views." }
            },
            {
                day: 3,
                theme: "Latin Quarter, Vintage Books & Wine by the Seine",
                morning: { time: "09:30 AM", act: "Île de la Cité & Shakespeare and Company Bookstore", loc: "Latin Quarter / Rue de la Bûcherie", tip: "Browse ceiling-high antique books in the legendary 1920s literary haven." },
                afternoon: { time: "01:30 PM", act: "Artisanal Falafel in Le Marais Trendy Quarter", loc: "L'As du Fallafel, Rue des Rosiers", tip: "Legendary warm pita packed with fried eggplant, tahini, and crispy chickpeas." },
                evening: { time: "07:00 PM", act: "Sunset Baguette & Cheese Picnic along Pont des Arts", loc: "Seine Riverbank", tip: "Every hour on the hour after dark, the Eiffel Tower sparkles for 5 magical minutes." }
            }
        ]
    },
    tokyo: {
        vibe: "Futuristic Metropolis & Ancient Shinto Serenity",
        summary: "A mind-blowing blend of neon-lit skyscraper alleys, serene Shinto forest shrines, Michelin-worthy street ramen, and futuristic digital art.",
        packingList: ["Slip-on comfortable shoes (frequent temple/restaurant shoe removals)", "Suica / Pasmo digital transit card on phone", "Pocket Wi-Fi or local eSIM for high-speed navigation", "Coin purse (Japan still loves 100 & 500 yen coins)", "Small hand towel (restrooms often don't have paper towels)"],
        insiderTips: [
            "Get the 72-hour Tokyo Subway Tourist Ticket at the airport for unlimited cheap rides.",
            "Convenience stores (7-Eleven, Lawson, FamilyMart) have incredible fresh meals (onigiri, fried chicken) for under $4.",
            "Stand on the left side of escalators in Tokyo (walk on the right)."
        ],
        days: [
            {
                day: 1,
                theme: "Ancient Asakusa & Skytree Panoramic Horizons",
                morning: { time: "08:30 AM", act: "Senso-ji Temple Morning Walk & Nakamise Shopping", loc: "Asakusa Historic District", tip: "Draw an omikuji fortune for 100 yen; sample warm melonpan pastries." },
                afternoon: { time: "01:00 PM", act: "Tokyo Skytree 450m Observation Deck & Akihabara Tech Alley", loc: "Oshiage & Akihabara", tip: "Explore 7-floor retro gaming and anime arcades in electric town." },
                evening: { time: "06:30 PM", act: "Solo Booth Tonkotsu Ramen at Ichiran", loc: "Ueno / Asakusa", tip: "Customize your broth richness, noodle firmness, and secret red garlic sauce." }
            },
            {
                day: 2,
                theme: "Meiji Shrine Peace, Harajuku & Shibuya Crossing Rush",
                morning: { time: "09:00 AM", act: "Meiji Jingu Shrine Cypress Forest Walk", loc: "Harajuku / Yoyogi", tip: "Huge cedar torii gates create an immediate calm oasis away from city noise." },
                afternoon: { time: "01:30 PM", act: "Takeshita Street Funky Boutiques & Marion Crepes", loc: "Harajuku", tip: "Try freshly rolled strawberry cheesecake crepes." },
                evening: { time: "05:45 PM", act: "Shibuya Sky Open-Air Deck & Famous Scramble Crossing", loc: "Shibuya Scramble Square", tip: "Watch thousands of pedestrians cross simultaneously under gigantic neon screens." }
            },
            {
                day: 3,
                theme: "Tsukiji Fresh Market & TeamLab Digital Immersion",
                morning: { time: "08:00 AM", act: "Tsukiji Outer Market Fresh Tuna Sashimi & Tamagoyaki", loc: "Tsukiji Market Lanes", tip: "Watch masters prepare sweet layered egg skewers for just 150 yen." },
                afternoon: { time: "01:30 PM", act: "TeamLab Planets Immersive Digital Art Museum", loc: "Toyosu Waterfront", tip: "Walk barefoot through knee-high water projections and infinite crystal mirror rooms." },
                evening: { time: "07:00 PM", act: "Smoky Yakitori Skewers in Omoide Yokocho Alley", loc: "Shinjuku Memory Lane", tip: "Cozy 6-seat tiny wooden izakayas serving charcoal grilled chicken skewers." }
            }
        ]
    },
    bali: {
        vibe: "Tropical Spiritual Haven & Ocean Cliffs",
        summary: "A soul-enriching tropical paradise of emerald rice terraces, sacred jungle waterfalls, holy water cleansing rituals, and cliffside ocean fire dances.",
        days: [
            {
                day: 1,
                theme: "Spiritual Ubud, Rice Terraces & Jungle Swings",
                morning: { time: "08:00 AM", act: "Tegalalang Rice Terraces Sunrise Walk & Jungle Swing", loc: "Tegalalang, Ubud", tip: "Mornings before 9:30 AM offer calm soft mist over the stepped green paddies." },
                afternoon: { time: "01:00 PM", act: "Sacred Monkey Forest Sanctuary & Organic Warung Lunch", loc: "Padangtegal, Ubud", tip: "Do not wear shiny sunglasses or carry loose food near the cheeky macaques." },
                evening: { time: "06:30 PM", act: "Ubud Royal Palace Traditional Gamelan Dance", loc: "Jl. Raya Ubud", tip: "Intricate gold costumes and expressive Balinese eye-movement dance." }
            },
            {
                day: 2,
                theme: "Holy Springs, Jungle Waterfalls & Cliffside Temples",
                morning: { time: "08:30 AM", act: "Tirta Empul Holy Water Cleansing Ritual (Melukat)", loc: "Tampak Siring", tip: "Rent a traditional green sarong to participate respectfully in holy fountain cleansing." },
                afternoon: { time: "01:30 PM", act: "Tibumana Jungle Waterfall Swim & Fresh Coconut", loc: "Bangli Regency", tip: "Hidden emerald pool surrounded by hanging jungle vines." },
                evening: { time: "05:30 PM", act: "Uluwatu Sunset Cliff Temple & Dramatic Kecak Fire Dance", loc: "Uluwatu Ocean Cliff", tip: "70-meter vertical limestone cliff over crashing waves as the sun sinks into the sea." }
            },
            {
                day: 3,
                theme: "Nusa Penida T-Rex Island Expedition & Beach Club",
                morning: { time: "07:30 AM", act: "Speedboat to Nusa Penida & Kelingking Beach T-Rex Cliff", loc: "Nusa Penida Island", tip: "One of the most jaw-dropping geological vistas on planet Earth." },
                afternoon: { time: "01:30 PM", act: "Angel's Billabong Natural Emerald Pool & Broken Beach", loc: "West Nusa Penida", tip: "Natural circular bay arch with crystal turquoise waters." },
                evening: { time: "07:00 PM", act: "Sunset Beanbag Lounging & Grilled Seafood in Jimbaran", loc: "Jimbaran Bay Beach", tip: "Candlelit wooden tables on the sand serving freshly caught red snapper and prawns." }
            }
        ]
    },
    dubai: {
        vibe: "Futuristic Glamour & Desert Dunes",
        summary: "An ultra-modern luxury wonderland of record-breaking skyscrapers, golden Arabian desert adventures, historic spice souks, and illuminated marina yacht cruises.",
        days: [
            {
                day: 1,
                theme: "Burj Khalifa Horizons & Historic Abra Creek",
                morning: { time: "09:00 AM", act: "Burj Khalifa 124th & 125th Floor Observation Deck", loc: "Downtown Dubai", tip: "Pre-book morning tickets online; enjoy 360-degree desert and Gulf skyline vistas." },
                afternoon: { time: "01:30 PM", act: "1-Dirham Traditional Abra Boat Ride & Gold Souk Walk", loc: "Dubai Creek / Deira", tip: "Historic contrast to modern towers; breathe in aromatic saffron and cardamom stalls." },
                evening: { time: "06:30 PM", act: "Dubai Fountain Choreographed Light Show & Dinner", loc: "Dubai Mall Promenade", tip: "Shows run every 30 minutes; grab an outdoor patio table facing the fountains." }
            },
            {
                day: 2,
                theme: "Red Dune Desert Safari & Starlit Bedouin Camp",
                morning: { time: "10:00 AM", act: "Dubai Frame Glass Skybridge Walk", loc: "Zabeel Park", tip: "Gaze at historic Old Dubai to the north and futuristic Burj Khalifa skyline to the south." },
                afternoon: { time: "03:00 PM", act: "4x4 Land Cruiser Red Dune Bashing & Sandboarding", loc: "Lahbab Red Sand Desert", tip: "Thrilling roller-coaster ride across 300-foot dunes followed by camel rides." },
                evening: { time: "07:00 PM", act: "Starlit Bedouin Camp BBQ & Fire Tanoura Dance Show", loc: "Desert Safari Camp", tip: "Enjoy henna painting, Arabic shawarma, and aromatic shisha under starry skies." }
            },
            {
                day: 3,
                theme: "Palm Jumeirah & Marina Sunset Cruise",
                morning: { time: "09:30 AM", act: "Palm Jumeirah Monorail to Atlantis The Palm", loc: "Palm Jumeirah Island", tip: "Engineering marvel shaped like a giant date palm tree." },
                afternoon: { time: "01:30 PM", act: "JBR Beach Promenade Stroll & Seaside Lunch", loc: "The Walk at JBR", tip: "Vibrant beach walk lined with alfresco cafés and gelato stands." },
                evening: { time: "06:00 PM", act: "Sunset Luxury Yacht Cruise through Dubai Marina", loc: "Dubai Marina Yacht Club", tip: "Pass beneath illuminated skyscrapers and the giant Ain Dubai Ferris wheel." }
            }
        ]
    }
};

/**
 * Universal Intelligent Generator for any destination worldwide
 */
function generateDynamicPlan(destination, numDays, budget, currency, style) {
    const key = destination.toLowerCase().trim();
    
    // Check if we have exact or partial match with our curated database
    for (const [destKey, data] of Object.entries(CURATED_DESTINATIONS)) {
        if (key.includes(destKey) || destKey.includes(key)) {
            const bVal = parseFloat(budget) || 15000;
            return {
                destination: destination.charAt(0).toUpperCase() + destination.slice(1),
                days: numDays,
                summary: data.summary,
                vibe: data.vibe || style,
                budgetBreakdown: {
                    stay: `${currency} ${Math.round(bVal * 0.40).toLocaleString()}`,
                    food: `${currency} ${Math.round(bVal * 0.25).toLocaleString()}`,
                    activities: `${currency} ${Math.round(bVal * 0.20).toLocaleString()}`,
                    transport: `${currency} ${Math.round(bVal * 0.15).toLocaleString()}`
                },
                packingList: data.packingList || [
                    "Comfortable all-day walking sneakers",
                    "Universal power adapter & power bank",
                    "Light rain jacket / layer for evening breezes",
                    "Reusable water bottle & personal essentials kit"
                ],
                insiderTips: data.insiderTips || [
                    `Download offline Google maps of ${destination} before heading out.`,
                    "Start your morning activities before 9:00 AM to enjoy uncrowded photo spots.",
                    "Ask local café owners for their favorite neighborhood food spots instead of tourist traps."
                ],
                dailyPlan: data.days.slice(0, numDays)
            };
        }
    }

    // Realistic smart contextual generator for other worldwide cities
    const bVal = parseFloat(budget) || 12000;
    const cleanDest = destination.trim();

    const universalThemes = [
        "Old Quarter Architecture, Sunrise Viewpoint & Signature Flavors",
        "Cultural Deep Dive, Historic Monuments & Artisan Bazaars",
        "Scenic Nature Escapes, Panoramas & Riverside Promenade",
        "Hidden Gems, Secret Neighborhood Cafés & Sunset Skyline",
        "Local Gastronomy Trail, Traditional Crafts & Twilight Plazas",
        "Art Galleries, Botanical Sanctuaries & Panoramic Lookouts",
        "Farewell Memories, Keepsake Souvenirs & Night Atmosphere"
    ];

    const morningActivities = [
        { act: "Historic Old Town Walking Trail & Morning Bakery", loc: `${cleanDest} Heritage Square`, tip: "Arrive before 8:30 AM to beat tourist tour groups and catch golden morning light." },
        { act: "Iconic Cultural Monument & Grand Architecture Tour", loc: `${cleanDest} Central Landmark`, tip: "Book tickets online beforehand to skip entry queue lines." },
        { act: "Sunrise Panoramic Hilltop / Rooftop Lookout", loc: `${cleanDest} Scenic Overlook`, tip: "Breathtaking 360-degree vista of the waking city; bring your camera." },
        { act: "Botanical Sanctuary & Tranquil Waterway Stroll", loc: `${cleanDest} Waterfront Gardens`, tip: "Serene morning spot for artisan coffee and peaceful reflection." }
    ];

    const afternoonActivities = [
        { act: "Authentic Local Gastronomy & Bistro Tasting", loc: `Renowned Local Eatery in ${cleanDest}`, tip: "Order the signature regional specialty dish with locally brewed iced tea." },
        { act: "Artisan Workshops & Traditional Craft Market Crawl", loc: `${cleanDest} Heritage Bazaar`, tip: "Support local craftspeople; polite bargaining is welcomed at market stalls." },
        { act: "Contemporary Art & Local History Discovery", loc: `${cleanDest} Cultural Museum`, tip: "Perfect air-conditioned midday retreat from the heat." },
        { act: "Scenic River / Canal Cruise or Vintage Tram Ride", loc: `${cleanDest} Promenade Pier`, tip: "Rest your legs while capturing scenic skyline angles from the water or rails." }
    ];

    const eveningActivities = [
        { act: "Golden Hour Sunset Terrace & Skyline Cocktails", loc: `${cleanDest} Sunset Sky Lounge`, tip: "Reserve a ledge table 30 mins before sunset for breathtaking golden rays." },
        { act: "Vibrant Night Food Market & Street Specialties Feast", loc: `${cleanDest} Evening Food Street`, tip: "Look for stalls with long local queues for peak freshness and flavor." },
        { act: "Candlelit Courtyard Dining & Live Acoustic Music", loc: `${cleanDest} Lantern-lit Bistro`, tip: "Try the chef's special dessert paired with regional beverages." },
        { act: "Illuminated Night Stroll & City Square Atmosphere", loc: `${cleanDest} Main Plaza`, tip: "The monuments light up beautifully after 7:30 PM with lively street musicians." }
    ];

    const dailyPlan = [];
    for (let d = 1; d <= numDays; d++) {
        dailyPlan.push({
            day: d,
            theme: universalThemes[(d - 1) % universalThemes.length],
            morning: morningActivities[(d - 1) % morningActivities.length],
            afternoon: afternoonActivities[(d - 1) % afternoonActivities.length],
            evening: eveningActivities[(d - 1) % eveningActivities.length]
        });
    }

    return {
        destination: cleanDest,
        days: numDays,
        summary: `A personalized ${numDays}-day journey across ${cleanDest} designed for immersive local sights, authentic regional eats, and unmissable photo viewpoints.`,
        vibe: style || "Balanced Cultural Exploration",
        budgetBreakdown: {
            stay: `${currency} ${Math.round(bVal * 0.40).toLocaleString()}`,
            food: `${currency} ${Math.round(bVal * 0.25).toLocaleString()}`,
            activities: `${currency} ${Math.round(bVal * 0.20).toLocaleString()}`,
            transport: `${currency} ${Math.round(bVal * 0.15).toLocaleString()}`
        },
        packingList: [
            "Comfortable broken-in walking shoes",
            "Universal travel adapter & high-capacity power bank",
            "Breathable layers & light windbreaker",
            "Reusable insulated water bottle"
        ],
        insiderTips: [
            `Download offline navigation maps of ${cleanDest} on your phone before departing.`,
            "Always keep a small amount of local physical currency for street vendors and small transport.",
            "Ask local café baristas for their favorite neighborhood eats rather than following tourist brochures."
        ],
        dailyPlan
    };
}

module.exports = {
    generateDynamicPlan,
    CURATED_DESTINATIONS
};
