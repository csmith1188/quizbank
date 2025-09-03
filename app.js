const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 1 minute(s)',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all routes
app.use(limiter);

// Middleware
app.use(cors());
app.use(express.json());



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 