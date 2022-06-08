var uuid = require('node-uuid-generator');
var db = require('./db.js');
var token = require('./token.js');
var sha256 = require('js-sha256').sha256;

const create = async(user_username, user_email, user_pass, user_fname, user_lname) => {
    return new Promise(async(resolve, reject) => {
        if (!validItem("username", user_username) || !validItem("email", user_email) || !validItem("password", user_pass) || !validItem("name", user_fname) || !validItem("name", user_lname)) {
            resolve(`{"result": "error","type": "Regex test failed"}`);
            return
        }
        if (await db.searchExists("users", "user_email", user_email)) {
            resolve(`{"result": "error","type": "Email Exists"}`);
            return
        }
        if (await db.searchExists("users", "user_username", user_username)) {
            resolve(`{"result": "error","type": "Username Exists"}`);
            return
        }
        var user_uuid = uuid.generate()
        var dbResult = JSON.parse(await db.insert(
            "users",
            "`UUID`, `user_username`, `user_email`, `user_pass`, `user_fname`, `user_lname`",
            `'${user_uuid}','${user_username}','${user_email}','SHA256$${sha256(user_uuid + "#" + user_pass)}','${user_fname}','${user_lname}'`
        ))
        if (dbResult.result == "success") resolve(`{"result": "success","uuid": "${user_uuid}"}`);
        else resolve(`{"result": "error","type": "unknown"}`);
    });
}
const loginToken = async(token_id, client_ip, client_id) => {
    return new Promise(async(resolve, reject) => {
        var tokenResult = JSON.parse(await token.validate(token_id, client_id, client_ip))
        if (tokenResult.result == "success") {
            var user = await db.search("users", "UUID", tokenResult.uuid)
            resolve(`{"result": "success","uuid": "${user.UUID}","username": "${user.user_username}","email": "${user.user_email}","token_expire": "${tokenResult.token_expire}"}`)
        } else resolve(`{"result": "error","type": "${tokenResult.type}"}`)
    });
}
const loginEmail = async(user_email, user_pass, client_ip, client_id) => {
    return new Promise(async(resolve, reject) => {
        if (await db.searchExists("users", "user_email", user_email)) {
            var user_info = await db.search("users", "user_email", user_email)
            if (user_info.user_pass != `SHA256$${sha256(user_info.UUID + "#" + user_pass)}`) return resolve(`{"result": "error","type": "Invalid Password"}`);
            var createTokenResult = JSON.parse(await token.generate("standard", user_info.UUID, client_id, client_ip))
            if (createTokenResult.result == "error") return resolve(`{"result": "error","type": "${createTokenResult.type}"}`);
            resolve(`{"result": "success","uuid": "${user_info.UUID}","token": "${createTokenResult.token}"}`)
        } else {
            resolve(`{"result": "error","type": "User doesn't exist"}`);
        }
    });
}
const getInfo = async(uuid) => {
    return new Promise(async(resolve, reject) => {
        if (await db.searchExists("users", "UUID", uuid)) {
            var user = await db.search("users", "UUID", uuid)
            resolve(`{"result": "success","user_username": "${user.user_username}","user_email": "${user.user_email}","user_email_verified": "${user.user_email_verified}","user_pass": "${user.user_pass}","user_fname": "${user.user_fname}","user_lname": "${user.user_lname}","user_registered": "${user.user_registered}","deleted": "${user.deleted}"}`)
        } else {
            resolve(`{"result": "error","type": "User doesn't exist"}`);
        }
    });
}
const edit = async(uuid, item, value) => {
    return new Promise(async(resolve, reject) => {
        if (await db.searchExists("users", "UUID", uuid)) {
            if ((item == "user_username" && !validItem("username", value)) || (item == "user_email" && !validItem("email", value)) || ((item == "user_fname" || item == "user_lname") && !validItem("name", value)) || (item == "user_pass" && !validItem("password", value))) {
                resolve(`{"result": "error","type": "Regex test failed"}`);
                return
            }
            if (item == "user_email" && await db.searchExists("users", "user_email", value)) {
                resolve(`{"result": "error","type": "Email Exists"}`);
                return
            }
            if (item == "user_username" && await db.searchExists("users", "user_username", value)) {
                resolve(`{"result": "error","type": "Username Exists"}`);
                return
            }
            if (item == "user_pass") {
                value = `SHA256$${sha256(uuid + "#" + value)}`
            }
            var dbResult = JSON.parse(await db.update(
                "users",
                item,
                value,
                "UUID",
                uuid
            ))
            if (dbResult.result == "success") resolve(`{"result": "success"}`);
            else resolve(`{"result": "error","type": "unknown"}`);
        } else {
            resolve(`{"result": "error","type": "User doesn't exist"}`);
        }
    });
}

const validItem = (item, value) => {
    switch (item) {
        case "username":
            return /^[A-Za-z0-9_-]{3,15}$/.test(value);
            break;
        case "email":
            return /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/.test(value);
            break;
        case "password":
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,32}$/.test(value);
            break;
        case "name":
            return /^[a-z ,.'-]+$/i.test(value);
            break;
        default:
            return false;
    }
}

module.exports = {
    create: create,
    loginToken: loginToken,
    loginEmail: loginEmail,
    getInfo: getInfo,
    edit: edit
};