const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../../quizsources/10th.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

console.log("Top-level data:", data);
console.log("Top-level id:", data.id);
