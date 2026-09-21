const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const PLAIN_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.text']);
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.text', '.pdf', '.docx']);

function getExtension(filename) {
    const ext = path.extname(String(filename || '')).toLowerCase();
    return ext;
}

function isAllowedFilename(filename) {
    return ALLOWED_EXTENSIONS.has(getExtension(filename));
}

function countWords(text) {
    const s = String(text || '').trim();
    if (!s) return 0;
    return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Extract plain text from a buffer based on original filename.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {Promise<string>}
 */
async function extractTextFromBuffer(buffer, originalName) {
    const ext = getExtension(originalName);
    if (PLAIN_EXTENSIONS.has(ext)) {
        return buffer.toString('utf8');
    }
    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        return (result && result.value) ? String(result.value) : '';
    }
    if (ext === '.pdf') {
        const result = await pdfParse(buffer);
        return (result && result.text) ? String(result.text) : '';
    }
    throw new Error('Unsupported file type: ' + ext);
}

module.exports = {
    ALLOWED_EXTENSIONS,
    PLAIN_EXTENSIONS,
    getExtension,
    isAllowedFilename,
    countWords,
    extractTextFromBuffer
};
