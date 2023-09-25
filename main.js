const hssp = require('hssp');
const tar = require('tar');
const http = require('http');
const https = require('https');
const fs = require('fs');
const plist = require('plist');
const bplist = require('bplist-parser');



const tvOSversion = parseInt(process.argv[2]) ?? 17; // must be 10 or higher



if (tvOSversion < 10) return;

const get = (url) => new Promise((resolve, reject) => (url.startsWith('https://') ? https : http).get(url, { rejectUnauthorized: false }, (response) => {
    var dlTarget = Buffer.alloc(0);

    response.on('data', (chnk) => dlTarget = Buffer.concat([dlTarget, chnk]));
    response.on('end', () => resolve(dlTarget));
    response.on('error', reject);
}));

const getDirsInDir = (dirPath, rmInName) => {
    dirPath = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
    const files = fs.readdirSync(dirPath);
    const result = [];

    files.forEach((file) => {
        const filePath = `${dirPath}/${file}`;
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            result.push(filePath);
            result.push(...getDirsInDir(filePath));
        };
    });

    if (rmInName) result.forEach((res, i) => result[i] = res.replace(dirPath + '/', ''));

    return result;
};

const getFilesInDir = (dirPath, rmInName) => {
    dirPath = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
    const files = fs.readdirSync(dirPath);
    const result = [];

    files.forEach((file) => {
        const filePath = `${dirPath}/${file}`;
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            result.push(...getFilesInDir(filePath));
        } else {
            result.push(filePath);
        };
    });

    if (rmInName) result.forEach((res, i) => result[i] = res.replace(dirPath + '/', ''));

    return result;
};

if (!fs.existsSync('./out/')) fs.mkdirSync('./out/');

fs.mkdirSync('./temp');
fs.mkdirSync('./temp/extracted');

var resourceUrl = tvOSversion > 12 ? 'https://sylvan.apple.com/Aerials/resources-' + tvOSversion + '.tar' : {
    '12': 'https://sylvan.apple.com/Aerials/resources.tar',
    '11': 'https://sylvan.apple.com/Aerials/2x/entries.json',
    '10': 'http://a1.phobos.apple.com/us/r1000/000/Features/atv/AutumnResources/videos/entries.json'
}[tvOSversion.toString()];

(async () => {
    if (tvOSversion == 17) resourceUrl = plist.parse((await get('https://configuration.apple.com/configurations/internetservices/aerials/resources-config.plist')).toString('utf8'))['resources-url'];

    if (tvOSversion > 11) {
        const data = await get(resourceUrl);
        if (data.toString('hex', 0, 1).toLowerCase() == '3c3f786d6c20766572') throw new Error('VERSION_TOO_HIGH');
        fs.writeFileSync('./temp/resources.tar', data);

        await new Promise((resolve, reject) => fs.createReadStream('./temp/resources.tar').pipe((() => {
            const extract = tar.extract({ cwd: './temp/extracted' });
            extract.on('finish', () => resolve());
            return extract;
        })()));

        fs.rmSync('./temp/resources.tar');
    } else if (tvOSversion > 9) {
        fs.writeFileSync('./temp/extracted/entries.json', await get(resourceUrl));
    } else throw new Error('VERSION_NOT_SUPPORTED');

    const resources = getFilesInDir('./temp/extracted', true);
    const resourcesDirs = getDirsInDir('./temp/extracted', true);

    const hsspArchive = new hssp.Editor();
    hsspArchive.addFolder('strings');
    hsspArchive.addFile('resources.json', Buffer.from(
        JSON.stringify(
            JSON.parse(
                fs.readFileSync('./temp/extracted/entries.json').toString('utf8')
            )
        )
    ), true);

    for (var i = 0; i < resources.length; i++) {
        if (resources[i].endsWith('.lproj/Localizable.nocache.strings')) hsspArchive.addFile('strings/' + resources[i].split('.')[1].split('/')[1], Buffer.from(
            JSON.stringify(
                bplist.parseBuffer(
                    fs.readFileSync('./temp/extracted/' + resources[i])
                )
            )
        ));
        fs.rmSync('./temp/extracted/' + resources[i]);
    };

    for (var i = resourcesDirs.length - 1; i > -1; i--) fs.rmdirSync('./temp/extracted/' + resourcesDirs[i]);

    fs.rmdirSync('./temp/extracted');
    fs.rmdirSync('./temp');

    fs.writeFileSync('./out/resources-' + tvOSversion + '.hssp', hsspArchive.toBuffer());
})();