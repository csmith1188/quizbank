// limit all the requested JSON data to be only the shallow children of the parent data and not the deep children
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./quizsources/courses.json", "utf-8"));

function getEntity(path) {
    let JSONdata = data;

    // For each part of the path, go through the JSON data
    // Part is either a key (string like section or course) or an ID of the key
    for (const part of path) {
        if (!JSONdata) return null;

        // If part is an ID, look up by id
        if (typeof part === "number") {
            if (Array.isArray(JSONdata)) {
                JSONdata = JSONdata.find(item => item.id === part);
            } else if (JSONdata.id === part) {
                // stay at JSONdata
            } else {
                return null;
            }
        }
        // Otherwise treat as a key (strings)
        else {
            JSONdata = JSONdata[part];
        }
    }
    return JSONdata;
}

// Give a shallow copy of the data that only including id and name of children nothing deeper
function shallow(JSONdata, depth = 2) {
    if (depth < 1 || !JSONdata) return null;

    // If it's an array return array of shallow copies
    if (Array.isArray(JSONdata)) {
        return JSONdata.map(n => shallow(n, depth - 1));
    }

    // If it's an object return shallow copy of it
    if (typeof JSONdata === "object") {
        const copy = { id: JSONdata.id, name: JSONdata.name };

        if (depth > 1) {
            // For every key inside the object and if its an array shallow copy them
            for (const [key, value] of Object.entries(JSONdata)) {
                if (Array.isArray(value)) {
                    copy[key] = value.map(v => shallow(v, depth - 1));
                }
            }
        }
        return copy;
    }

    return JSONdata;
}

module.exports = { 
    getEntity, 
    shallow 
};