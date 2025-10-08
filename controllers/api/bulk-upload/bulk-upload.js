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

    router.post('/upload', (req, res) => {
        upload.single('sheet')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const sectionUid = req.body.sectionUid;
            const parsedData = parseSheet(req.file.buffer);
            await uploadSheetData(parsedData, sectionUid);
            res.send('Data uploaded successfully.')
        });
    });
};