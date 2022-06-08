const express = require('express')
var bodyParser = require('body-parser')
const cors = require('cors');
const user = require('./user.js');
const email = require('./email.js');
const token = require('./token.js');
var sha256 = require('js-sha256').sha256;

const app = express();
app.use(bodyParser.json())

app.use(cors());
app.listen(100, () => {
    console.log('Accepting requests on port 100');
});
app.set('trust proxy', true)

app.post('/users/register', async(req, res) => {
    const { client_id, client_ip } = JSON.parse(authFromHeaders(req))
    const { user_username, user_email, user_pass, user_fname, user_lname } = req.body
    res.setHeader('Content-Type', 'application/json');
    var createUserResult = JSON.parse(await user.create(user_username, user_email, user_pass, user_fname, user_lname))
    if (createUserResult.result == "error") return res.end(`{"result": "error","type": "${createUserResult.type}"}`);
    email.sendVerification(createUserResult.uuid)
    var createTokenResult = JSON.parse(await token.generate("standard", createUserResult.uuid, client_id, client_ip))
    if (createTokenResult.result == "error") return res.end(`{"result": "error","type": "${createTokenResult.type}"}`);
    res.end(`{"result": "success","uuid": "${createUserResult.uuid}","token": "${createTokenResult.token}"}`);
});
app.post('/users/login', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    var type = req.query.type
    res.setHeader('Content-Type', 'application/json');
    switch (type) {
        case "token":
            var results = await user.loginToken(user_token, client_ip, client_id)
            res.end(results);
            break;
        case "email":
            const { user_email, user_pass } = req.body
            var results = await user.loginEmail(user_email, user_pass, client_ip, client_id)
            res.end(results);
            break;
        default:
            res.end(`{"result": "error","type": "No Type Specified"}`);
    }
});
app.post('/users/logout', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validate(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    var results = await token.del(user_token)
    res.end(results);
});
app.post('/users/info', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validate(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    var userInfo = JSON.parse(await user.getInfo(tokenResult.uuid))
    if (userInfo.result != "success") return res.end(`{"result": "error","type": "${userInfo.type}"}`);
    res.end(`{"result": "success","UUID": "${tokenResult.uuid}","user_username": "${userInfo.user_username}","user_email": "${userInfo.user_email}","user_email_verified": "${userInfo.user_email_verified}","user_fname": "${userInfo.user_fname}","user_lname": "${userInfo.user_lname}","user_registered": "${userInfo.user_registered}","deleted": "${userInfo.deleted}"}`);
});
app.get('/users/info', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validate(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    var userInfo = JSON.parse(await user.getInfo(tokenResult.uuid))
    if (userInfo.result != "success") return res.end(`{"result": "error","type": "${userInfo.type}"}`);
    res.end(`{"result": "success","UUID": "${tokenResult.uuid}","user_username": "${userInfo.user_username}","user_email": "${userInfo.user_email}","user_email_verified": "${userInfo.user_email_verified}","user_fname": "${userInfo.user_fname}","user_lname": "${userInfo.user_lname}","user_registered": "${userInfo.user_registered}","deleted": "${userInfo.deleted}"}`);
});
app.post('/users/edit', async(req, res) => { //fix sql injection
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    const { item, value } = req.body
    res.setHeader('Content-Type', 'application/json');
    if (item != "user_username" && item != "user_email" && item != "user_fname" && item != "user_lname") return res.end(`{"result": "error","type": "invalid item"}`);
    var tokenResult = JSON.parse(await token.validate(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    var results = await user.edit(tokenResult.uuid, item, value)
    res.end(results);
});
app.post('/users/password/change', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    const { oldPassword, newPassword } = req.body
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validate(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    var userInfo = JSON.parse(await user.getInfo(tokenResult.uuid))
    if (userInfo.result != "success") return res.end(`{"result": "error","type": "${userInfo.type}"}`);
    if (`SHA256$${sha256(tokenResult.uuid + "#" + oldPassword)}` != userInfo.user_pass) return res.end(`{"result": "error","type": "Incorrect Password"}`);
    var results = await user.edit(tokenResult.uuid, "user_pass", newPassword)
    res.end(results);
});
app.post('/email/verify', async(req, res) => {
    const { email_token } = req.body
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validate(email_token, "null", "null"))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    if (tokenResult.token_type != "email") return res.end(`{"result": "error","type": "invalid email token"}`);
    var results = await user.edit(tokenResult.uuid, "user_email_verified", 1)
    token.del(email_token)
    res.end(results);
});
app.post('/token/renew', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validate(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    if (tokenResult.token_type != "standard") return res.end(`{"result": "error","type": "invalid token type"}`);
    token.del(user_token)
    var createTokenResult = JSON.parse(await token.generate("standard", tokenResult.uuid, client_id, client_ip))
    if (createTokenResult.result == "error") return res.end(`{"result": "error","type": "${createTokenResult.type}"}`);
    res.end(`{"result": "success","uuid": "${tokenResult.uuid}","token": "${createTokenResult.token}"}`);
});
app.get('/token/application/generate', async(req, res) => {
    const { client_id, client_ip } = JSON.parse(authFromHeaders(req))
    res.setHeader('Content-Type', 'application/json');
    var applicationTokenResult = await token.generateApplication("client", client_id, client_ip)
    res.end(applicationTokenResult);
});
app.post('/token/application/attach', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    const { application_token } = req.body
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validate(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    if (tokenResult.token_type != "standard") return res.end(`{"result": "error","type": "invalid token type"}`);
    var applicationTokenResult = JSON.parse(await token.validateApplication(application_token, "console", client_ip))
    if (applicationTokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    var result = await token.attachApplication(application_token, tokenResult.uuid, applicationTokenResult.client_id, client_ip)
    res.end(result); //Attach original token client id to new token
});
app.get('/token/application/info', async(req, res) => {
    const { client_id, client_ip, user_token } = JSON.parse(authFromHeaders(req))
    res.setHeader('Content-Type', 'application/json');
    var tokenResult = JSON.parse(await token.validateApplication(user_token, client_id, client_ip))
    if (tokenResult.result != "success") return res.end(`{"result": "error","type": "${tokenResult.type}"}`);
    res.end(`{"result": "success","replacement_token": "${tokenResult.replacement_token}","token_type": "${tokenResult.token_type}","token_expire": "${tokenResult.token_expire}"}`);
});

const authFromHeaders = (req) => {
    //Get ip
    if (req.headers.id != undefined || req.headers.token != undefined) return `{"client_id": "${req.headers.id}", "client_ip": "${req.ip}", "user_token": "${req.headers.token}"}`
    var headers = req.headers["user-agent"];
    if (headers != undefined && (headers.includes("id") || headers.includes("token"))) {
        headers = JSON.parse(headers.replace(/\'/g, '"'))
        return `{"client_id": "${headers.id}", "client_ip": "${req.ip}", "user_token": "${headers.token}"}`
    } else return `{"client_id": "null", "client_ip": "${req.ip}", "user_token": "null"}`
}