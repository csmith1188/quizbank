const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const rateLimit = require('express-rate-limit');
const resource = require('./middleware/resource');
const errorHandler = require('./middleware/error-handler');
const db = require("./db/db");
const { readDirPaths } = require('./util/file-helpers');
const localsmiddleware = require('./middleware/locals');
const {isAuthenticated} = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/client-js', express.static(__dirname + '/static/client-js'));

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'change_this_secret',
    resave: false,
    saveUninitialized: false,
}));

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
app.use(express.static('static'));

app.use(localsmiddleware);

const controllers = readDirPaths('./controllers');

// register controllers dynamically
// folder structure defines the route prefix
controllers.forEach(controllerPath => {
    const pathPieces = controllerPath.split('/');
    const prefix = '/' + pathPieces.slice(0, -1).join('/');
    const filename = pathPieces[pathPieces.length - 1];
    const router = express.Router();
    const register = require('./controllers/' + controllerPath);

    if (typeof register === 'function') {
        register(router);
        app.use(prefix, router);
    }

});

// Resource resolver middleware
app.use('/api/resource', isAuthenticated, resource);

// must be last middleware
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 