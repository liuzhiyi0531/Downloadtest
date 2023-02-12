require('dotenv').config();

const { Telegraf } = require('telegraf');
const fs = require('fs');
const request = require('then-request');
const kv = require('./kamiya_modules/key-value');

const bot = new Telegraf(process.env.TGBOTTOKEN);

const adminPass = process.env.ADMINPASS;

process.env.TZ = 'Asia/Shanghai';

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

const D = new kv('./data/bot.json');

const L = new kv('./data/data.json');

const B = new kv('./data/dreambooth.json');

const cleanMessage = (R,ctx) => {
    const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
    return new Promise(async (resolve) => {
        await sleep(5000);
        if(ctx.update.message.chat.type != 'private') {
            bot.telegram.deleteMessage(ctx.update.message.chat.id,R.message_id).catch((e) => {console.log(`WARN Failed to clean 1 message in chat ${ctx.update.message.chat.id}.`,e)});
            bot.telegram.deleteMessage(ctx.update.message.chat.id,ctx.update.message.message_id).catch((e) => {console.log(`WARN Failed to clean 1 message in chat ${ctx.update.message.chat.id}.`,e)});
        }
        resolve(true);
    })
}

bot.command('start', (ctx) => {ctx.reply('/reg 发送注册请求\n/info 信息查询');});

bot.command('reg', (ctx) => {
    const id = ctx.update.message.from.id;
    if(ctx.update.message.chat.type == 'private') {
        if(!D.get(`${id}.token`)) {
            request('GET',`${process.env.TGBOTURL}/api/add_user?adminPass=${adminPass}&from=${encodeURIComponent(`Telegram ${id}`)}`).getBody('utf8').then(JSON.parse).done(function(R) {
                D.put(`${id}.token`,R.token);
                ctx.reply(`注册完成\nToken:${R.token}\n请妥善保管Token，这是每个用户的唯一身份凭证`);
            });
        }
        else ctx.reply('您已经注册了，发送 /info 查询注册信息');
    }
    else ctx.reply('仅允许在与Bot的私聊中注册').then(R => cleanMessage(R,ctx));
});
bot.command('info', (ctx) => {
    const id = ctx.update.message.from.id;
    if(ctx.update.message.chat.type == 'private') {
        if(D.get(`${id}.token`)) {
            ctx.reply(`Token:${D.get(`${id}.token`)}\n请妥善保管Token，这是每个用户的唯一身份凭证`);
        }
        else ctx.reply('您尚未注册，发送 /reg 进行注册');
    }
    else ctx.reply('仅允许在与Bot的私聊中查询').then(R => cleanMessage(R,ctx));
});
bot.command('signin',(ctx) => {
    ctx.reply('已停止使用社交平台进行签到，请打开 kamiya.dev 进行签到').then(R => cleanMessage(R,ctx));
});

bot.command('left',(ctx) => {
    const id = ctx.update.message.from.id;
    const token = D.get(`${id}.token`);
    if(token) {
        ctx.reply(`Kamiya ID Status\nID: ${id}\n用户组: ${L.get(`${token}.group`)}\n魔晶点数: ${L.get(`${token}.left`)}`);
    }
    else ctx.reply('您尚未注册，私聊Bot发送 /reg 进行注册').then(R => cleanMessage(R,ctx));
});

bot.command('add_left',(ctx) => {
    const adminList = JSON.parse(fs.readFileSync('./data/botadmin.json'));
    const id = ctx.update.message.from.id;
    if(adminList.telegram.indexOf(id) != -1) {
        if(ctx.update.message.reply_to_message) {
            const aid = ctx.update.message.reply_to_message.from.id;
            const token = D.get(`${aid}.token`);
            if(token) {
                const s = ctx.update.message.text.split(' ');
                if(s.length == 2) {
                    L.put(`${token}.left`,L.get(`${token}.left`) + (s[1] * 1));
                    ctx.reply('已为 ID: ' + aid + ' 添加' + s[1] + '魔晶点数');
                }
                else ctx.reply('用法错误 /add_left 点数');
            }
            else ctx.reply('要添加次数的用户未注册，私聊Bot发送 /reg 进行注册');
        }
        else ctx.reply('请回复一条消息');
    }
    else ctx.reply('该命令仅限Bot管理员使用');
});

bot.command('set_group',(ctx) => {
    const adminList = JSON.parse(fs.readFileSync('./data/botadmin.json'));
    const id = ctx.update.message.from.id;
    if(adminList.telegram.indexOf(id) != -1) {
        if(ctx.update.message.reply_to_message) {
            const aid = ctx.update.message.reply_to_message.from.id;
            const token = D.get(`${aid}.token`);
            if(token) {
                const s = ctx.update.message.text.split(' ');
                if(s.length == 2) {
                    L.put(`${token}.group`,s[1]);
                    ctx.reply('已将 ID: ' + aid + ' 设置为' + s[1] + '用户');
                }
                else ctx.reply('用法错误 /set_group 用户组');
            }
            else ctx.reply('要设置的用户未注册，私聊Bot发送 /reg 进行注册');
        }
        else ctx.reply('请回复一条消息');
    }
    else ctx.reply('该命令仅限Bot管理员使用');
});

function bubbleSort(arr) {
    var len = arr.length;
    for (var i = 0; i < len - 1; i++) {
        for (var j = 0; j < len - 1 - i; j++) {
            if (arr[j] > arr[j+1]) {
                var temp = arr[j+1];
                arr[j+1] = arr[j];
                arr[j] = temp;
            }
        }
    }
    return arr;
}

bot.command('stats',(ctx) => {
    const overview = JSON.parse(fs.readFileSync('./logs/overview.json'));
    let keys = Object.keys(overview);
    keys[0] = '2099-12-31';
    keys = bubbleSort(keys);
    ctx.reply(`自 ${keys[0]}\n\n今日生成图片:${overview[keys[keys.length - 2]]}\n共生成图片:${overview.total}\n最后一次生成:${dateFormat("mm-dd HH:MM:SS",new Date(JSON.parse(fs.readFileSync('./logs/lastlog.json')).time))}\n\nfrom Kamiya`);
});

bot.command('celebrate_dreambooth',(ctx) => {
    const id = ctx.update.message.from.id;
    if(ctx.update.message.chat.type != 'private') {
        const token = D.get(`${id}.token`);
        if(token) {
            //if((Date.parse(new Date()) - D.get(`${id}.last`)) > 86400000) {
            if(!D.get(`${id}.cdb`)) {
                L.put(`${token}.left`,L.get(`${token}.left`) + 66);
                D.put(`${id}.cdb`,true);
                ctx.reply('成功领取Dreambooth贺礼，已获得66魔晶点数').then(R => cleanMessage(R,ctx));
            }
            else ctx.reply('该贺礼仅允许领取一次').then(R => cleanMessage(R,ctx));
        }
        else ctx.reply('您尚未注册，私聊Bot发送 /reg 进行注册').then(R => cleanMessage(R,ctx));
    }
    else ctx.reply('仅支持在群组中获取');
});

bot.command('get_compensation',(ctx) => {
    const id = ctx.update.message.from.id;
    if(ctx.update.message.chat.type != 'private') {
        const token = D.get(`${id}.token`);
        if(token) {
            //if((Date.parse(new Date()) - D.get(`${id}.last`)) > 86400000) {
            if(!D.get(`${id}.comp`)) {
                L.put(`${token}.left`,L.get(`${token}.left`) + 120);
                D.put(`${id}.comp`,true);
                ctx.reply('成功领取计费补偿，已获得120魔晶点数').then(R => cleanMessage(R,ctx));
            }
            else ctx.reply('该贺礼仅允许领取一次').then(R => cleanMessage(R,ctx));
        }
        else ctx.reply('您尚未注册，私聊Bot发送 /reg 进行注册').then(R => cleanMessage(R,ctx));
    }
    else ctx.reply('仅支持在群组中获取');
});

bot.command('check_access_cyannai',(ctx) => {
    const id = ctx.update.message.from.id;
    const token = D.get(`${id}.token`);
    if(token) {
        bot.telegram.getChatMember(-1001814222297,id).then((r) =>{
            if(r.status != 'left') {
                B.put(`${token}.cynanai`,true);
                ctx.reply('检查已通过，所有需要 @CyanNAI 权限的模型在账户ID: ' + id + ' 中已可用').then(R => cleanMessage(R,ctx));
            }
            else ctx.reply('您尚未加入 @CyanNAI\n应分发协议要求，我们无法为您添加访问权限').then(R => cleanMessage(R,ctx));
        },
        () => {
            ctx.reply('您尚未加入 @CyanNAI\n应分发协议要求，我们无法为您添加访问权限').then(R => cleanMessage(R,ctx));
        });
    }
    else ctx.reply('您尚未注册，私聊Bot发送 /reg 进行注册').then(R => cleanMessage(R,ctx));
})

bot.command('check_status',(ctx) => {
    const adminList = JSON.parse(fs.readFileSync('./data/botadmin.json'));
    const id = ctx.update.message.from.id;
    if(adminList.telegram.indexOf(id) != -1) {
        if(ctx.update.message.reply_to_message) {
            const aid = ctx.update.message.reply_to_message.from.id;
            const token = D.get(`${aid}.token`);
            if(token) {
                ctx.reply(`Kamiya ID Status\nID: ${aid}\n用户组: ${L.get(`${token}.group`)}\n魔晶点数: ${L.get(`${token}.left`)}`);
            }
            else ctx.reply('要查看的用户未注册，私聊Bot发送 /reg 进行注册').then(R => cleanMessage(R,ctx));
        }
        else ctx.reply('请回复一条消息').then(R => cleanMessage(R,ctx));
    }
    else ctx.reply('该命令仅限Bot管理员使用').then(R => cleanMessage(R,ctx));
});

bot.command('help',(ctx) => {
    ctx.reply('Kamiya OpenID Help\n\n 私聊命令\n/reg 注册\n/info 查看OpenID\n\n群聊命令\n/signin 签到\n/left 查询OpenID信息\n/stats 查看使用量统计\n/check_access_cyannai 检查对来自CYANNAI模型的访问权\n\nfrom Kamiya');
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));