const sql = require('sqlite3').verbose();
const dbInstance = new sql.Database(process.env.DB_PATH);
dbInstance.serialize(() => {
    dbInstance.run("PRAGMA foreign_keys = ON;");
});

function run(sql, params) {
    return new Promise(async (resolve, reject) => {
        dbInstance.run(sql, params, function(err) {
            if (err) reject(err);
            resolve(this.lastID);
        });
    });
}

function get(sql, params) {
    return new Promise(async (resolve, reject) => {
        dbInstance.get(sql, params, (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

function all(sql, params) {
    return new Promise(async (resolve, reject) => {
        dbInstance.all(sql, params, (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

module.exports = {
    run,
    get,
    all,
}