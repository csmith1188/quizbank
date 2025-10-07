const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseSheet, uploadSheetData } = require('../../../services/upload-service');

const router = express.Router();

// store files in memory (you can also store to disk if preferred)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(xls|xlsx)$/)) {
      return cb(new Error('Only Excel files allowed'), false);
    }
    cb(null, true);
  }
});

module.exports = (router) => {

    router.get('/', (req, res) => {
        res.render('pages/teacher/upload-test');
    });

    // upload and validate the Excel file, return preview of parsed data
    router.post('/validate', (req, res) => {

        upload.single('file')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                const parsedData = parseSheet(req.file.buffer);
                // return a preview of the parsed data for confirmation
                res.json({ preview: parsedData.slice(0, 5) }); // return first 5 rows as preview
            } catch (parseErr) {
                res.status(500).json({ error: 'Error parsing file: ' + parseErr.message });
            }
        });
        
    });

    // save the previously validated data to the database
    router.post('/upload', (req, res) => {

    });
};