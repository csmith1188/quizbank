const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseSheet, uploadSheetData } = require('../../../services/upload-service');
const { getSection, getResourceOwnerUid } = require('../../../services/resource-service');

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

            const sectionUid = req.body.sectionUid;

            if (typeof sectionUid === 'undefined' || sectionUid === null) {
                throw new Error("sectionUid not specified");
            }

            const sectionOwnerUid = await getResourceOwnerUid('section', sectionUid);

            if (sectionOwnerUid !== req.session.user.uid) {
                throw new Error("You do not have permission to modify this section");
            }

            if (!req.file) {
                throw new Error("No file uploaded");
            }
            
            const parsedData = parseSheet(req.file.buffer);
            await uploadSheetData(parsedData, sectionUid);

            const newSectionData = await getSection(sectionUid);

            res.json(newSectionData);
        });
    });
};