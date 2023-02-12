require('dotenv').config();

const http = require('http');
const shell = require('shelljs');
const fs = require('fs');

const resPwd = shell.pwd();

const server = http.createServer((req,res) => {
    if(req.url.match(process.env.ADMINPASS)) {
        const option = {
            cwd: resPwd.stdout
        };
        shell.exec('git pull',option);
        shell.exec('rm -rf ./data/dreambooth/*.json',option);
        shell.exec('cp ./data.exam/dreambooth/* ./data/dreambooth/',option);
        shell.exec('npm install',option);
        const dataList = fs.readdirSync('./data/');
        const examList = fs.readdirSync('./data.exam/');
        examList.forEach((e) => {
            if(dataList.indexOf(e) == -1) shell.exec(`cp ./data.exam/${e} ./data/`,option);
        });
        shell.exec('pm2 restart 0 1',option);
        res.end('Done');
    }
    else res.end('Token Error');
});

server.listen(process.env.HOOKPORT);