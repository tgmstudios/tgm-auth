var nodemailer = require('nodemailer');
var fs = require('fs');
const user = require('./user.js');
const token = require('./token.js');

const {email_smtp_host, email_smtp_port, email_smtp_auth_user, email_smtp_auth_pass, email_verify_url, email_from_name} = require('../config.json');

var emailServer = nodemailer.createTransport({
    host: email_smtp_host,
    port: email_smtp_port,
    secure: true,
    auth: {
        user: email_smtp_auth_user,
        pass: email_smtp_auth_pass
    }
});

const sendVerification = async(uuid) => {
    return new Promise(async(resolve, reject) => {
        var userInfo = JSON.parse(await user.getInfo(uuid))
        var tokenResult = JSON.parse(await token.generate("email", uuid, "null", "null"))
        if (tokenResult.result != "success") return resolve(`{"result": "error", "type": "${tokenResult.type}"}`)
        var verifyURL = email_verify_url + tokenResult.token //Merges Custom Verify URL with token.  Example https://account.tgmstudios.net/email/verify?token=${token}
        emailServer.sendMail({
            from: `"${email_from_name}" <${email_smtp_auth_user}>`,
            to: userInfo.user_email,
            subject: `Please verify your email address`,
            html: await fs.readFileSync('templates/email/verify.html').toString().replace(/\{email.verify.url}/g, verifyURL).replace(/\{user.fname}/g, userInfo.user_fname)
        }, function(error, info) {
            if (error) {
                return console.log(error);
            }
        });
        resolve(`{"result": "success"}`)
    });
}

module.exports = {
    sendVerification: sendVerification
};