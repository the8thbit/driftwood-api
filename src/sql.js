const fs = require('fs');
const path = require("path");

const startPath = 'src/sql'

const getSqlObj = (sqlPath) => {
    try {
        const sqlObj = {};
        const safePath = sqlPath.replace(/\/+$/, ''); // remove trailing slash
        const files = fs.readdirSync(safePath);

        for (const file of files) {
            if (file.charAt(0) !== `_`) {
                const fullPathObj = path.join(safePath, file);
                const pathInfo = fs.statSync(fullPathObj);

                if (pathInfo.isFile()) {
                    if (
                        file.length > 4 &&
                        file.substring(file.length - 4) === `.sql`
                    ) {
                        propName = file.substring(0, file.length - 4);
                        sqlObj[propName] = fs
                            .readFileSync(`${safePath}/${file}`, "utf8")
                        ;
                    } else if (
                        file.length > 3 &&
                        file.substring(file.length - 3) === `.js`
                    ) {
                        propName = file.substring(0, file.length - 3);
                        sqlObj[propName] = require(`../${safePath}/${file}`);
                    } else {
                        throw(`${file}: not a sql script or js module`);
                    }
                } else if (pathInfo.isDirectory()) {
                    sqlObj[file] = getSqlObj(`${safePath}/${file}`);
                } else {
                    throw(`${file}: unknown path type`);
                }
            }
        }

        return sqlObj;
    } catch (e) {
        console.error(`[sql scripts import error]`, e);
    }
}

module.exports = getSqlObj(startPath);