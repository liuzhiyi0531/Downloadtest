require('dotenv').config();

const Mirai = require('node-mirai-sdk');

const { Plain, At } = Mirai.MessageComponent;

const request = require('then-request');

const midurl = process.env.QQ_MID_URL;
const adminPass = process.env.ADMINPASS;
const bot = new Mirai({
    host: 'ws://127.0.0.1:8080',
    verifyKey: process.env.MIRAI_KEY,
    qq: process.env.MIRAI_QQ,
    enableWebsocket: true,
    wsOnly: false
});

bot.onSignal('authed', () => {
    console.log(`Authed with session key ${bot.sessionKey}`);
    bot.verify();
});

bot.onSignal('verified', async () => {
    console.log(`Verified with session key ${bot.sessionKey}`);
    const friendList = await bot.getFriendList();
    console.log(`There are ${friendList.length} friends in bot`);
});

bot.onMessage(async message => {
    const { type, sender, messageChain, reply, quoteReply } = message;
    let msg = '';
    messageChain.forEach(chain => {
        if (chain.type === 'Plain')
            msg += Plain.value(chain);
    });
    if(msg.startsWith('注册')) {
        let req;
        if(msg.startsWith('注册 ')) req = msg.split('注册 ')[1];
        if(msg.startsWith('注册\n')) req = msg.split('注册\n')[1];
        if(!req) {
            quoteReply([At(sender.id), Plain(` 正确请求格式为 注册 验证码，请检查消息格式`)]);
            return;
        }
        req = req.replace(' ','').replace('\n','');
        request('GET',`${midurl}/api/set_id?adminPass=${adminPass}&q=${encodeURIComponent(req)}&id=${sender.id}`).getBody('utf8').then(JSON.parse).done(function(R) {
            request('GET',`${midurl}/api/get_pass?adminPass=${adminPass}&q=${encodeURIComponent(req)}`).getBody('utf8').then(JSON.parse).done(function(R) {
                if(R.p == null) {
                    quoteReply([At(sender.id), Plain(` 无法在我们的系统中查找到请求的注册码，请检查消息格式`)]);
                    return;
                }
                quoteReply([At(sender.id), Plain(` 你的验证码是 ${R.p}`)]);
            },() => {
                quoteReply([At(sender.id), Plain(` 无法与中间件联系，请联系群组管理员报告此问题或稍后再试`)]);
            });
        },() => {
            quoteReply([At(sender.id), Plain(` 无法与中间件联系，请联系群组管理员报告此问题或稍后再试`)]);
        });
    };
    if(msg.startsWith('找回')) {
        let req;
        if(msg.startsWith('找回 ')) req = msg.split('找回 ')[1];
        if(msg.startsWith('找回\n')) req = msg.split('找回\n')[1];
        if(!req) {
            quoteReply([At(sender.id), Plain(` 正确请求格式为 找回 验证码，请检查消息格式`)]);
            return;
        }
        request('GET',`${midurl}/api/set_getback_resolved?adminPass=${adminPass}&q=${encodeURIComponent(req)}&id=${sender.id}`).getBody('utf8').then(JSON.parse).done(function(R) {
            if(R.success) quoteReply([At(sender.id), Plain(` 找回请求已被验证，请返回网页点击 获取Token 按钮`)]);
            else quoteReply([At(sender.id), Plain(` 找回请求验证失败，该QQ与请求找回的QQ号不匹配`)]);
        },() => {
            quoteReply([At(sender.id), Plain(` 无法与中间件联系，请联系群组管理员报告此问题或稍后再试`)]);
        });
    };
    if(msg.startsWith('/signin')) {
        quoteReply([At(sender.id), Plain(` 已停止使用社交平台进行签到，请打开 官网 进行签到`)]);
    };
});

bot.listen('all');

process.on('exit', () => {
    bot.release();
});