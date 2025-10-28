const multer = require('multer');
const path = require('path');
const { parseSheet } = require('../../../services/upload-service');
const { getSection, getResourceOwnerUid, insertUploadData} = require('../../../services/resource-service');

const router = express.Router();

// store files in memory
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
            await insertUploadData(parsedData, sectionUid);

            const updatedSectionData = await getSection(sectionUid);

            res.json(updatedSectionData);
        });
    });
};