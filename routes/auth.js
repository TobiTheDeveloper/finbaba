// Authentication routes

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { users, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Check if user exists
        for (const [id, user] of users.entries()) {
            if (user.email === email) {
                return res.status(400).json({ error: 'Email already registered' });
            }
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const newUser = {
            id: userId,
            email,
            name: name || email.split('@')[0],
            password: hashedPassword,
            subscription: {
                tier: 'free',
                status: 'active',
                startDate: new Date().toISOString()
            },
            usage: {},
            createdAt: new Date().toISOString()
        };
        
        users.set(userId, newUser);
        
        // Generate JWT
        const token = jwt.sign(
            { 
                id: userId, 
                email,
                subscription: newUser.subscription
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: userId,
                email,
                name: newUser.name,
                subscription: newUser.subscription
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Find user
        let foundUser = null;
        for (const [id, user] of users.entries()) {
            if (user.email === email) {
                foundUser = user;
                break;
            }
        }
        
        if (!foundUser) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, foundUser.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT
        const token = jwt.sign(
            { 
                id: foundUser.id, 
                email: foundUser.email,
                subscription: foundUser.subscription
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: foundUser.id,
                email: foundUser.email,
                name: foundUser.name,
                subscription: foundUser.subscription
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.get(decoded.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            subscription: user.subscription,
            usage: user.usage
        });
        
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
