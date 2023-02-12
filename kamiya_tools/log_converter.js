const fs = require('fs');

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

const list = fs.readdirSync('./logs_old');
for(let i in list) {
    if(list[i].match('.log')) continue;
    const token = list[i].split('.')[0],id = list[i].split('.')[1];
    let l = JSON.parse(fs.readFileSync('./logs_old/' + list[i]));
    if(l.query.image) {
        fs.writeFileSync('./logs/images/' + id + '.json',JSON.stringify({image: l.query.image},0,2));
        delete l.query.image;
    }
    l.token = token;
    l.id = id;
    l.tag = 'imagedraw';
    let nl;
    try {
        nl = JSON.parse(fs.readFileSync('./logs/' + dateFormat("YYYY-mm-dd",new Date(l.time)) + '.json'));
    }
    catch (e) {
        fs.writeFileSync('./logs/' + dateFormat("YYYY-mm-dd",new Date(l.time)) + '.json','[]');
        nl = [];
    }
    nl.push(l);
    fs.writeFileSync('./logs/' + dateFormat("YYYY-mm-dd",new Date(l.time)) + '.json',JSON.stringify(nl,0,2));
    let o = JSON.parse(fs.readFileSync('./logs/overview.json'));
    o.total += 1;
    o[dateFormat("YYYY-mm-dd",new Date(l.time))] += 1;
    fs.writeFileSync('./logs/overview.json',JSON.stringify(o,0,2));
};



