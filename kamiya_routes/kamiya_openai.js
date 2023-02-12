require('dotenv').config();

const express = require('express');
const bodyparser = require('body-parser');
const request = require('then-request');

const { Configuration, OpenAIApi } = require('openai');
const kv = require("../kamiya_modules/key-value");
const fs = require("fs");
const imageUpload = require("../kamiya_modules/image_upload");

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

process.env.TZ = 'Asia/Shanghai';

const app = express.Router();

app.use(bodyparser.json({ limit:'1000mb'}));

const D = new kv('./data/data.json');

const S = new kv('./data/pass.json');

const C = new kv('./data/openai_conversation.json');

function check_pass(pass) {
    if(!S.get(`${pass}.logout`) && S.get(`${pass}.token`) && (Date.parse(new Date()) - S.get(`${pass}.time`)) < 604800000) return true;
    return false;
};

function uuid() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
    s[8] = s[13] = s[18] = s[23] = "-";
    var uuid = s.join("");
    return uuid;
}

function dateFormat(fmt, date) {
    let ret;
    const opt = {
        "Y+": date.getFullYear().toString(),
        "m+": (date.getMonth() + 1).toString(),
        "d+": date.getDate().toString(),
        "H+": date.getHours().toString(),
        "M+": date.getMinutes().toString(),
        "S+": date.getSeconds().toString()
    };
    for (let k in opt) {
        ret = new RegExp("(" + k + ")").exec(fmt);
        if (ret) {
            fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")));
        };
    };
    return fmt;
}

function get_token(pass) {return S.get(`${pass}.token`);};
function get_left(token) {return D.get(`${token}.left`);};

function cut_prompt(prompt, context, conversation_id, max_length) {
    const p = new Promise((resolve) => {
        let r = ''
        prompt = context + 'Human:' + prompt + '\n AI:';
        request('POST',process.env.PROMPT_SERVER,{json: {
                prompt: prompt,
                history_str: prompt,
                token_limit: 1500,
                extra_token: 350
            }}).getBody('utf8').then(JSON.parse).done(function(R) {
            console.log({
                id: conversation_id,
                status: 'nlp http code 200',
                response: R
            });
            if(R.code != 200) {
                prompt = context + 'Human:' + prompt + '\n AI:';
                if(prompt.length <= max_length) r = prompt;
                r = prompt.substring(prompt.length - max_length,prompt.length);
                resolve(r);
            }
            for (let i in R.data) {
                r += '\n' + R.data[i];
            }
            resolve(r);
        },(e) =>{
            console.log({
                id: conversation_id,
                status: 'nlp http error'
            },e);
            prompt = context + 'Human:' + prompt + '\n AI:';
            if(prompt.length <= max_length) r = prompt;
            r = prompt.substring(prompt.length - max_length,prompt.length);
            resolve(r);
        });
    });
    return p;
}

app.post('/api/openai/conversation',async (req,res) => {
    console.log(req.body);

    const pass = req.body.pass;

    if(!pass || !check_pass(pass)) {res.send({success: false});return;};
    const token = get_token(pass);
    if(!(get_left(token) > 0)) {res.send({success: false,message: '剩余魔晶点数不足'});return;};

    const action = req.body.action;
    let conversation_id = req.body.conversation_id;

    let head;

    if(conversation_id) {
        let ctx = C.get(conversation_id);
        head = ctx;
    }
    else {
        conversation_id = uuid();
        head = req.body.head;
        if(!head) head = 'The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.\n\nHuman: 你好，你能帮助我做什么？\\nAI: 我是由OpenAI创造的AI，有什么可以帮到你的吗？\n'
    }

    let prompt = req.body.prompt;
    cut_prompt(prompt,head,conversation_id,1500).then((prompt) => {
        let o = JSON.parse(fs.readFileSync('./logs/chatdemo.json'));
        if(o[dateFormat("YYYY-mm-dd",new Date())]) o[dateFormat("YYYY-mm-dd",new Date())] += 1;
        else o[dateFormat("YYYY-mm-dd",new Date())] = 1;
        fs.writeFileSync('./logs/chatdemo.json',JSON.stringify(o,0,2));

        openai.createCompletion({
            model: 'text-davinci-003',
            prompt: prompt,
            temperature: 0.9,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0.6,
            max_tokens: 350,
            stop: [
                'Human:',
                'AI:'
            ]
        }).then((R) => {
            D.put(`${token}.left`,(get_left(token) - 0.1).toFixed(1) * 1);
            const result = R.data.choices[0].text;
            C.put(conversation_id,prompt + result + '\n');
            res.send({
                success: true,
                conversation_id: conversation_id,
                result: result
            });
        },(e) => {
            console.log(e.response.data.error);
            res.send({
                success: false,
                conversation_id: conversation_id,
                message: e.response.data.error.message + '，将此ID上报以快速定位此次错误' + conversation_id
            });
        });
    });
});

module.exports = app;