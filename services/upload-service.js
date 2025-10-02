let fs = require("fs");
let { Readable } = require("stream");
let xlsx = require("xlsx");
let { sequelize, User, Course, Section, Unit, Task, Question } = require("../db/db");
const { col } = require("sequelize");

const testFilePath = "./quizsources/testsheet.xlsx";
let fileData = fs.readFileSync(testFilePath);
xlsx.stream.set_readable(Readable);
let workbook = xlsx.read(fileData, { type: "buffer" });

let worksheet = workbook.Sheets[workbook.SheetNames[0]];
const raw_data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

// template
const SHEET_HEADERS = new Map([
    ['unit', 0],
    ['task', 1],
    ['prompt', 2],
    ['correctIndex', 3]
]);



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

function sheetHasHeaderRow(sheetData) {
    const sheetFirstCell = sheetData[0][0].toLowerCase().trim();
    const templateFirstCell = Array.from(SHEET_HEADERS)[0][0];
    return sheetFirstCell === templateFirstCell;
}


module.exports.parseQuestionSheet = (sheetData) => {
    const numCols = sheetData[0].length;
    const hasHeaderRow = sheetHasHeaderRow(sheetData);
    const firstDataRowNum = hasHeaderRow ? 1 : 0;
    const questions = [];

    for (let row = firstDataRowNum; row < sheetData.length; row++) {
        // check for empty cells
        for (let col = 0; col < numCols; col++) {
            const cellValue = sheetData[row][col] || '';
            if (cellValue == '') {
                throw new Error("Empty cell at row " + (row + 1) + " column " + indexToRowLetter(col));
            }
        }

        const rowData = sheetData[row];
        const answers = [];

        for (let col = SHEET_HEADERS.get('correctIndex') + 1; col < numCols; col++) {
            const cellValue = rowData[col] || '';
            if (cellValue != '') {
                answers.push(cellValue);
            }
        }

        if (answers.length < 2) {
            throw new Error("Not enough answers at row " + (row + 1) + ". Found " + answers.length + ", minimum is 2.");
        }

        const belongsTo = {
            course: rowData[SHEET_HEADERS.get('course')],
            section: rowData[SHEET_HEADERS.get('section')],
            unit: rowData[SHEET_HEADERS.get('unit')],
            task: rowData[SHEET_HEADERS.get('task')]
        }

        const prompt = rowData[SHEET_HEADERS.get('prompt')];
        const correctIndex = rowLetterToIndex(rowData[SHEET_HEADERS.get('correctIndex')]) - SHEET_HEADERS.get('correctIndex') - 1;
        const correctAnswer = rowData[correctIndex];

        const question = {
            index: null, // to be filled in later
            ai: false,
            prompt,
            correctAnswer,
            correctIndex,
            answers
    };

    questions.push({ belongsTo, question });

}

return questions;
}

console.log(JSON.stringify(module.exports.parseQuestionSheet(raw_data), null, 2));

module.exports.uploadQuestionSheetData = (data) => {

}