const tokenGen = require('@supercharge/strings')
const db = require('./db.js');

var generate = async(token_type, account_uuid, client_id, client_ip) => {
    return new Promise(async(resolve, reject) => {
        if (await db.searchExists("users", "UUID", account_uuid)) {
            var token_id = tokenGen.random(64)
            var token_expire = new Date();
            if (token_type == "standard") token_expire.setDate(token_expire.getDate() + 30);
            if (token_type == "email") token_expire.setDate(token_expire.getDate() + 14);
            if (token_type == "application") token_expire.setDate(token_expire.getDate() + 360);
            var dbResult = JSON.parse(await db.insert(
                "tokens",
                "`token_id`, `token_type`, `token_expire`, `account_uuid`, `client_ip`, `client_id`",
                `'${token_id}','${token_type}','${datetime(token_expire)}','${account_uuid}','${client_ip}','${client_id}'`
            ))
            if (dbResult.result == "success") resolve(`{"result": "success","token": "${token_id}"}`);
            else resolve(`{"result": "error","type": "unknown"}`);
        } else {
            resolve(`{"result": "error","type": "User doesn't exist"}`);
        }
    });
}
var validate = async(token_id, client_id, client_ip) => {
    return new Promise(async(resolve, reject) => {
        if (await db.searchExists("tokens", "token_id", token_id)) {
            var token_info = await db.search("tokens", "token_id", token_id)
            if (token_info.valid != "1") return resolve(`{"result": "error","type": "Invalid Token"}`);
            if (client_id != token_info.client_id) return resolve(`{"result": "error","type": "Invalid ID"}`);
            if (Date.now() > datejs(token_info.token_expire)) {
                del(token_id)
                return resolve(`{"result": "error","type": "Token Expired"}`);
            }
            resolve(`{"result": "success","uuid": "${token_info.account_uuid}","token_type": "${token_info.token_type}","token_expire": "${token_info.token_expire}"}`);
        } else {
            resolve(`{"result": "error","type": "Token doesn't exist"}`);
        }
    });
}
var del = async(token_id) => {
    return new Promise(async(resolve, reject) => {
        var dbResult = JSON.parse(await db.update(
            "tokens",
            "valid",
            `0`,
            "token_id",
            token_id
        ))
        if (dbResult.result == "success") resolve(`{"result": "success"}`);
        else resolve(`{"result": "error","type": "unknown"}`);
    });
}
var generateApplication = async(token_type, client_id, client_ip) => {
    return new Promise(async(resolve, reject) => {
        var token_id = tokenGen.random(64)
        var token_expire = new Date();
        if (token_type == "client") token_expire.setDate(token_expire.getDate() + 1);
        var dbResult = JSON.parse(await db.insert(
            "application_tokens",
            "`token_id`, `token_type`, `token_expire`, `replacement_token`, `client_ip`, `client_id`",
            `'${token_id}','${token_type}','${datetime(token_expire)}','null','${client_ip}','${client_id}'`
        ))
        if (dbResult.result == "success") resolve(`{"result": "success","token": "${token_id}"}`);
        else resolve(`{"result": "error","type": "unknown"}`);
    });
}
var attachApplication = async(application_token, account_uuid, client_id, client_ip) => {
    return new Promise(async(resolve, reject) => {
        var token_result = JSON.parse(await generate("application", account_uuid, client_id, client_ip))
        if (token_result.result != "success") return resolve(`{"result": "error","type": "${token_result.type}"}`);
        var dbResult1 = JSON.parse(await db.update(
            "application_tokens",
            "replacement_token",
            token_result.token,
            "token_id",
            application_token
        ))
        if (dbResult1.result != "success") return resolve(`{"result": "error","type": "${dbResult1.type}"}`);
        resolve(`{"result": "success","token": "${token_result.token}"}`);
    });
}
var validateApplication = async(token_id, client_id, client_ip) => {
    return new Promise(async(resolve, reject) => {
        if (await db.searchExists("application_tokens", "token_id", token_id)) {
            var token_info = await db.search("application_tokens", "token_id", token_id)
            if (token_info.valid != "1") return resolve(`{"result": "error","type": "Invalid Token"}`);
            if (client_id != token_info.client_id && client_id != "console") return resolve(`{"result": "error","type": "Invalid ID"}`);
            if (Date.now() > datejs(token_info.token_expire)) {
                del(token_id)
                return resolve(`{"result": "error","type": "Token Expired"}`);
            }
            resolve(`{"result": "success","replacement_token": "${token_info.replacement_token}","token_type": "${token_info.token_type}","token_expire": "${token_info.token_expire}","client_id": "${token_info.client_id}"}`);
        } else {
            resolve(`{"result": "error","type": "Token doesn't exist"}`);
        }
    });
}

var datetime = (datejs) => {
    return `${datejs.getFullYear()}-${datejs.getMonth() + 1}-${datejs.getDate()} ${datejs.getHours()}:${datejs.getMinutes()}:${datejs.getSeconds()}`
}
var datejs = (datetime) => {
    return new Date(datetime)
}

module.exports = {
    generate: generate,
    validate: validate,
    del: del,
    generateApplication: generateApplication,
    attachApplication: attachApplication,
    validateApplication: validateApplication
};