let fs = require("fs");
let { Readable } = require("stream");
let xlsx = require("xlsx");
let { sequelize, User, Course, Section, Unit, Task, Question } = require("../db/db");

xlsx.stream.set_readable(Readable);

// template
const SHEET_HEADERS = ['unit', 'task', 'prompt', 'type', 'correctIndex'];

// create map for quick lookup of header indices
const SHEET_HEADERS_MAP = new Map();
SHEET_HEADERS.forEach((header, index) => {
    SHEET_HEADERS_MAP.set(header, index);
});

function rowLetterToIndex(letter) {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
        index *= 26;
        index += letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1; // convert to zero-based index
}

function indexToRowLetter(index) {
    let letter = '';
    index += 1; // convert to one-based index
    while (index > 0) {
        let mod = (index - 1) % 26;
        letter = String.fromCharCode(mod + 'A'.charCodeAt(0)) + letter;
        index = Math.floor((index - mod) / 26);
    }
    return letter;
}

function validateSheetData(sheetData) {

    if (sheetData[0].length < SHEET_HEADERS_MAP.size) {
        throw new Error("Not enough columns in sheet. Found " + numCols + ", minimum is " + (SHEET_HEADERS_MAP.size));
    }
}

// check if the first row matches the template headers (optional)
// just necessary to know if we should skip the first row when parsing
function sheetHasHeaderRow(sheetData) {
    const sheetFirstCell = sheetData[0][0].toLowerCase().trim();
    const templateFirstCell = Array.from(SHEET_HEADERS_MAP)[0][0];
    return sheetFirstCell === templateFirstCell;
}

function sheetFileDataToJSON(fileData) {
    let workbook = xlsx.read(fileData, { type: "buffer" });
    let worksheet = workbook.Sheets[workbook.SheetNames[0]];
    return xlsx.utils.sheet_to_json(worksheet, { header: 1 });
}

module.exports.parseSheet = (sheetFileData) => {

    const sheetData = sheetFileDataToJSON(sheetFileData);
    validateSheetData(sheetData);

    const numCols = sheetData[0].length;
    const hasHeaderRow = sheetHasHeaderRow(sheetData);
    const firstDataRowNum = hasHeaderRow ? 1 : 0;
    const parsed = [];

    for (let row = firstDataRowNum; row < sheetData.length; row++) {

        // check for empty cells
        for (let col = 0; col < SHEET_HEADERS_MAP.size - 1; col++) {
            const cellValue = sheetData[row][col] || '';
            if (cellValue == '') {
                throw new Error("Empty cell at row " + (row + 1) + " column " + indexToRowLetter(col));
            }
        }

        const rowData = sheetData[row];
        const answers = [];

        // collect answers from columns after 'correctIndex'
        for (let col = SHEET_HEADERS_MAP.get('correctIndex') + 1; col < numCols; col++) {
            const cellValue = rowData[col] || '';
            if (cellValue != '') {
                answers.push(cellValue);
            }
        }

        const createNew = {
            unitName: rowData[SHEET_HEADERS_MAP.get('unit')],
            taskName: rowData[SHEET_HEADERS_MAP.get('task')]
        }

        const prompt = rowData[SHEET_HEADERS_MAP.get('prompt')];
        let type = rowData[SHEET_HEADERS_MAP.get('type')];
        type = type.toLowerCase().replace(/\s+/g, '-'); // ensure type is kebab-case

        const correctIndicesRaw = rowData[SHEET_HEADERS_MAP.get('correctIndex')];

        let correctIndices = [];
        let correctAnswers = [];

        // if there is no correct indexes, then the question is probably open-ended
        if (correctIndicesRaw){

            correctIndices = correctIndicesRaw.split('').map(idx => {
                idx = idx.trim();
                return rowLetterToIndex(idx) - SHEET_HEADERS_MAP.get('correctIndex') - 1;
            });

            correctAnswers = correctIndices.map(idx => answers[idx]);

        }

        const question = {
            ai: false,
            prompt,
            type,
            correctAnswers,
            correctIndices,
            answers
        };

        parsed.push({
            createNew,
            question 
        });

    }

    return parsed;

}