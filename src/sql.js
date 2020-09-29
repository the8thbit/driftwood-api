const fs = require('fs');

const sqlPath = 'src/sql'

const getSqlStr = (sqlFilePath) => {
    return fs.readFileSync(`${sqlPath}/${sqlFilePath}.sql`).toString();
}

module.exports = {
    helloWorld: getSqlStr('helloWorld'),
    getUsersById: getSqlStr('getUsersById'),
    getUsersByUsername: getSqlStr('getUsersByUsername'),
    addUserWithLocalCreds: getSqlStr('addUserWithLocalCreds')
};