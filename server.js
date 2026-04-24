require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'bot', '.env') });
const session = require('express-session');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Enable Helmet for security headers (configured for basic apps without strictly blocking CDNs/FontAwesome)
app.use(helmet({
    contentSecurityPolicy: false, // Disabled to allow external CDNs like FontAwesome and inline styles from the current design
    crossOriginEmbedderPolicy: false
}));

// Setup Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'electro_default_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files (HTML, CSS, JS, Images)
app.use(express.static(__dirname));

// Initialize MySQL DB
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'electro_db',
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS applications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            discordId VARCHAR(255),
            discordUsername VARCHAR(255),
            name VARCHAR(255),
            age INT,
            experience VARCHAR(255),
            reason TEXT,
            story TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('Connected to the MySQL database and verified applications table.');
    } catch (err) {
        console.error('Database connection or initialization failed:', err);
    }
})();

// --- Discord OAuth Routes ---

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// 1. Redirect to Discord Login
app.get('/auth/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;
    res.redirect(url);
});

// 2. Discord Callback Handler
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login.html?error=no_code');

    try {
        // Exchange code for token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // Get User Info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // Save User Info in Session
        req.session.user = {
            id: userResponse.data.id,
            username: userResponse.data.username,
            global_name: userResponse.data.global_name,
            avatar: userResponse.data.avatar,
            email: userResponse.data.email
        };

        res.redirect('/'); // Redirect to home on success
    } catch (error) {
        console.error('Discord Auth Error:', error.response ? error.response.data : error.message);
        res.redirect('/login.html?error=auth_failed');
    }
});

// 3. Get Current User Session Info
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// 4. Logout
app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- API Routes ---

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 API requests per windowMs
    message: { error: 'تم تجاوز الحد المسموح به من الطلبات. الرجاء المحاولة لاحقاً.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 1. Submit Application
app.post('/api/submit-application', apiLimiter, async (req, res) => {
    const { discordId, discordUsername, name, age, experience, reason, story } = req.body;
    
    const query = `INSERT INTO applications (discordId, discordUsername, name, age, experience, reason, story) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    try {
        const [result] = await pool.execute(query, [discordId, discordUsername, name, age, experience, reason, story]);

        // Auto-assign Whitelist role via Discord API
        try {
            const botToken = process.env.DISCORD_BOT_TOKEN;
            const guildId = process.env.DISCORD_GUILD_ID;
            const whitelistRoleId = process.env.WHITELIST_ROLE_ID;
            
            if (botToken && guildId && whitelistRoleId) {
                await axios.put(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${whitelistRoleId}`, {}, {
                    headers: { Authorization: `Bot ${botToken}` }
                });
                console.log(`Auto-assigned whitelist role to user ${discordId}`);
            }
        } catch (e) {
            console.error('Failed to assign whitelist role automatically:', e.response ? e.response.data : e.message);
        }

        res.status(200).json({ success: true, message: 'Application submitted successfully!', id: result.insertId });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

// 2. Get All Applications (For Admin Dashboard)
app.get('/api/applications', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM applications ORDER BY created_at DESC`);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch applications.' });
    }
});

// 3. Update Application Status (Approve/Reject/Ban)
app.post('/api/applications/:id/status', async (req, res) => {
    const id = req.params.id;
    const { status } = req.body; // 'approved', 'rejected', 'banned'
    
    if (!['approved', 'rejected', 'banned', 'pending'].includes(status)) {
         return res.status(400).json({ error: 'Invalid status.' });
    }

    try {
        await pool.execute(`UPDATE applications SET status = ? WHERE id = ?`, [status, id]);
        
        // Manual roles are given when status changes
        const [rows] = await pool.query(`SELECT discordId FROM applications WHERE id = ?`, [id]);
        if (rows.length > 0 && rows[0].discordId) {
            const discordId = rows[0].discordId;
            const botToken = process.env.DISCORD_BOT_TOKEN;
                const guildId = process.env.DISCORD_GUILD_ID;
                const whitelistRoleId = process.env.WHITELIST_ROLE_ID;
                const approvedRoleId = process.env.APPROVED_ROLE_ID;
                const rejectedRoleId = process.env.REJECTED_ROLE_ID;
                const bannedRoleId = process.env.BANNED_ROLE_ID;

                if (botToken && guildId) {
                    try {
                        const headers = { Authorization: `Bot ${botToken}` };
                        
                        // Wait to avoid rate limits
                        if (status === 'approved' && approvedRoleId) {
                            await axios.put(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${approvedRoleId}`, {}, { headers });
                            // Optionally keep whitelist role
                        } else if (status === 'rejected' && rejectedRoleId) {
                            await axios.put(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${rejectedRoleId}`, {}, { headers });
                            // Optionally remove whitelist role:
                            if (whitelistRoleId) await axios.delete(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${whitelistRoleId}`, { headers }).catch(() => {});
                        } else if (status === 'banned' && bannedRoleId) {
                            await axios.put(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${bannedRoleId}`, {}, { headers });
                            // Optionally remove whitelist role:
                            if (whitelistRoleId) await axios.delete(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${whitelistRoleId}`, { headers }).catch(() => {});
                        }
                    } catch (e) {
                        console.error('Failed to update roles based on status:', e.response ? e.response.data : e.message);
                    }
                }
            }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update status.' });
    }
});

// 4. API Endpoint for Discord Bot to Check Whitelist Status
app.get('/api/bot/check-whitelist/:discordId', async (req, res) => {
    const discordId = req.params.discordId;
    
    // Optional: Add a simple secret key check to secure this endpoint from public access
    const authHeader = req.headers.authorization;
    const botSecret = process.env.BOT_API_SECRET || 'electro_bot_secret_123';
    
    if (authHeader !== `Bearer ${botSecret}`) {
        return res.status(403).json({ error: 'Unauthorized access.' });
    }

    try {
        const [rows] = await pool.query(`SELECT status FROM applications WHERE discordId = ? ORDER BY created_at DESC LIMIT 1`, [discordId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ whitelisted: false, message: 'No application found for this user.' });
        }

        const row = rows[0];
        if (row.status === 'approved') {
            res.status(200).json({ whitelisted: true, status: row.status });
        } else {
            res.status(200).json({ whitelisted: false, status: row.status });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Database error.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
