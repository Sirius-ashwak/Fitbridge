const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Fallback for HTML5 history (if needed) or simple routing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`FitBridge AI Server running on http://localhost:${PORT}`);
});
