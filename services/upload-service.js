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

    // keeps track of new units and tasks to be created, prevents duplicates
    const newUnits = new Set();
    const newTasks = new Set();
    const parsed = [];

    for (let row = firstDataRowNum; row < sheetData.length; row++) {
        // check for empty cells
        for (let col = 0; col < SHEET_HEADERS.size; col++) {
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
            sectionUid: null,
            unitName: rowData[SHEET_HEADERS.get('unit')],
            taskName: rowData[SHEET_HEADERS.get('task')]
        }

        const prompt = rowData[SHEET_HEADERS.get('prompt')];
        const correctIndex = rowLetterToIndex(rowData[SHEET_HEADERS.get('correctIndex')]) - SHEET_HEADERS.get('correctIndex') - 1;
        const correctAnswer = rowData[SHEET_HEADERS.get('correctIndex') + correctIndex + 1];

        // for db
        const question = {
            index: null, // to be filled in later
            ai: false,
            prompt,
            correct_answer: correctAnswer,
            correct_index: correctIndex,
            answers
        };

        parsed.push({ belongsTo, question });

    }
    
    parsed.newUnits = newUnits;
    parsed.newTasks = newTasks;

    return parsed;

}

module.exports.uploadQuestionSheetData = (data) => {

    return sequelize.transaction(async (t) => {

        for (let item of data) {
            const {sectionUid, unitName, taskName} = item.belongsTo;
            const question = item.question;

            // find section
            const sectionEntity = await Section.findOne({
                where: {
                    uid: sectionUid,
                },
                transaction: t
            });

            if (!sectionEntity) {
                throw new Error(`Section not found`);
            }

            // create unit
            const lastUnitIndex = await Unit.max('index', {
                where: {
                    sectionUid: sectionUid
                },
                transaction: t
            });

            const unitEntity = await Unit.create({
                name: unitName,
                index: (lastUnitIndex || 0) + 1,
                sectionUid: sectionUid,
            }, { transaction: t });

            // create task
            const taskEntity = await Task.create({
                name: taskName,
                index: 0,
                unitId: unitEntity.uid,
            }, { transaction: t });

            // find next question index
            const lastQuestionIndex = await Question.count({
                where: {
                    taskUid: taskEntity.uid
                },
                transaction: t
            });
            
            // prepare question data for insertion
            question.index = lastQuestionIndex + 1;
            question.taskUid = taskEntity.uid;
            question.answers = JSON.stringify(question.answers);

            // create question
            await Question.create(question, { transaction: t });

        }

    });

}

//console.log(JSON.stringify(module.exports.parseQuestionSheet(raw_data), null, 2));

const parsedTestData = module.exports.parseQuestionSheet(raw_data);
parsedTestData.forEach(question => question.belongsTo.sectionUid = 1);

module.exports.uploadQuestionSheetData(parsedTestData);