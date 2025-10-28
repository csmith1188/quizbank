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

// limit the depth of the hierarchial data
function shallow(data, depth = 2) {
    if (depth < 0) return null;
  
    // Handle arrays (e.g. top-level array of courses)
    if (Array.isArray(data)) {
      return data.map(item => shallow(item, depth));
    }
  
    // Handle plain objects
    if (data && typeof data === "object") {
      const result = {};
  
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          // We've found the child array (the hierarchical step)
          result[key] = depth > 0
            ? shallow(value, depth - 1) // descend
            : undefined;                        // stop here
        } else if (
          value === null ||
          typeof value !== "object" ||
          value instanceof Date
        ) {
          // Copy only primitive fields (id, name, etc.)
          result[key] = value;
        }
      }
  
      return result;
    }
  
    // Base case for strings/numbers/etc.
    return data;
  }

module.exports = { 
    getEntity, 
    shallow 
};