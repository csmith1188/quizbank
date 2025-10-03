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

const convert = require('./BBconvert/convert_to_blackboard_enhanced');

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

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 1 minute(s)',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(cors());
app.use(express.json());
app.use(express.static('static'));
app.use(localsmiddleware);

const controllers = readDirPaths('./controllers');
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

app.use('/api/resource', isAuthenticated, resource);
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    convert();
});