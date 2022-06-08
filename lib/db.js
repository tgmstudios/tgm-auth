var mysql = require('mysql');

const {mysql_host, mysql_port, mysql_user, mysql_pass, mysql_db} = require('../config.json');

var credentials = {
    host: mysql_host,
    port: mysql_port,
    user: mysql_user,
    password: mysql_pass,
    database: mysql_db
};
var connection;
const handleConnectDisconnect = () => {
    console.log("Connecting to database.")
    connection = mysql.createConnection(credentials);
    connection.connect((err) => {
        if (err) {
            console.log("Error connecting to DB: " + err)
            setTimeout(handleConnectDisconnect, 2000);
        } else {
            console.log("Connected to database.")
        }
    });
    connection.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log("Error: PROTOCOL_CONNECTION_LOST\nReconnecting to database.")
            handleConnectDisconnect();
        } else {
            console.log("Error: " + err + "\nReconnecting to database.")
            handleConnectDisconnect();
        }
    });
}
handleConnectDisconnect()

const insert = async(table, fields, values) => {
    return new Promise(async(resolve, reject) => {
        connection.query("INSERT INTO `" + table + "` (" + fields + ") VALUES (" + values + ");", function(error, results, fields) {
            if (error) {
                console.log(error)
                resolve(`{"result": "error","type": "${error}"}`);
            }
            resolve(`{"result": "success"}`);
        });
    })
}
const search = async(table, field, query) => {
    return new Promise(async(resolve, reject) => {
        connection.query("SELECT * FROM `" + table + "` WHERE `" + field + "` = '" + query + "'", function(error, results, fields) {
            if (error) {
                console.log(error)
                resolve(`{"result": "error","type": "${error}"}`)
            }
            resolve(results[0])
        });
    });
}
const update = async(table, field, value, search, query) => {
    return new Promise(async(resolve, reject) => {
        connection.query("UPDATE `" + table + "` SET `" + field + "` = '" + value + "' WHERE `" + table + "`.`" + search + "` = '" + query + "';", function(error, results, fields) {
            if (error) {
                console.log(error)
                resolve(`{"result": "error","type": "${error}"}`)
            }
            resolve(`{"result": "success"}`);
        });
    });
}
const searchExists = async(table, field, query) => {
    return new Promise(async(resolve, reject) => {
        connection.query("SELECT * FROM `" + table + "` WHERE `" + field + "` = '" + query + "'", function(error, results, fields) {
            if (error) {
                console.log(error)
                resolve(false)
            }
            if (results[0] != undefined) resolve(true);
            else resolve(false);
        });
    });
}

module.exports = {
    insert: insert,
    search: search,
    update: update,
    searchExists: searchExists
};