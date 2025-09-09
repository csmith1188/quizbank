// limit all the requested JSON data to be only the shallow children of the parent data and not the deep children
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./quizsources/10th.json", "utf-8"));

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
function shallow(JSONdata) {

    // If it's an array return array of shallow copies
    if (Array.isArray(JSONdata)) {
        return JSONdata.map(n => ({ id: n.id, name: n.name }));
    }

    // If it's an object return shallow copy of it
    if (JSONdata && typeof JSONdata === "object") {
        // Make a copy with only id and name
        const copy = { id: JSONdata.id, name: JSONdata.name };

        // For each key in the object then if it's an array, make a shallow copy of it
        for (const [key, value] of Object.entries(JSONdata)) {
            if (Array.isArray(value)) {
                copy[key] = value.map(v => ({ id: v.id, name: v.name }));
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