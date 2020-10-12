module.exports = (tagCount) => {
    const getParams = (count) => {
        let outputArr = [];
        for (let i = 0; i < count; i++) {
            outputArr.push('`name` = ?');
        }
        return outputArr.join(' OR ');
    }

    return '' +
        'SELECT' +
        '    *' +
        'FROM' +
        '    `site_categories`' +
        'WHERE ' + getParams(tagCount) + ' AND ' +
        '`enabled` = 1 ' +
        ';' +
    '';
}
