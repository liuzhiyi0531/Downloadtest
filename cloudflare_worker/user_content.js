const postToken = '[Your Own Token]';

const URL = '[Your Own URL]';

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

function checkURL(URL) {
    var str = URL;
    var Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
    var objExp = new RegExp(Expression);
    if (objExp.test(str) == true) {
        return true;
    } else {
        return false;
    }
}

function parseDataUrl(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return [new Blob([u8arr], {type:mime}), mime];
}

export default {
    async fetch(request, env) {
        let url = request.url;
        if(url.split('?token=').length == 2) {
            const token = url.split('?token=')[1];

            if (request.method == 'POST') {
                if(token === postToken) {
                    let b = await request.json();
                    let u = uuid();

                    const data = parseDataUrl(b.image);

                    await env.R2.put('usercontent/' + u,data[0].stream());

                    return new Response(JSON.stringify({
                        uuid: u,
                        url: URL + 'usercontent/' + u
                    }));
                }
            }
            return new Response('Token Error', { status: 403 });
        }
        return new Response('Token Error', { status: 403 });
    }
};