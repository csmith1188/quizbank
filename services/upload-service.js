let fs = require("fs");
let {Readable} = require("stream");
let xlsx = require("xlsx");

const testFilePath = "./quizsources/testsheet.xlsx";
let fileData = fs.readFileSync(testFilePath);
xlsx.stream.set_readable(Readable);
let workbook = xlsx.read(fileData, {type: "buffer"});

let worksheet = workbook.Sheets[workbook.SheetNames[0]];
const raw_data = xlsx.utils.sheet_to_json(worksheet, {header: 1});

function rowLetterToIndex(letter) {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
        index *= 26;
        index += letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1; // convert to zero-based index
}

// takes in 2D array of sheet data and outputs question data ready for database
function parseQuestionSheet(sheetData) {
    const headerRow = sheetData[0];
    const questions = [];

    for (i = 1; i < sheetData.length; i++) {
        
    }
}

console.log(JSON.stringify(parseQuestionSheet(sheetData), null, 2));

function uploadToDatabase(parsedData) {
    
}