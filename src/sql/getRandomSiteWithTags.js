module.exports = (andTagCount, orTagCount, notTagCount) => {
    const getParams = (count) => {
        let outputArr = [];
        for (let i = 0; i < count; i++) {
            outputArr.push('?');
        }
        return outputArr.join();
    }

    let havingConditions = [];

    if (andTagCount > 0) {
        havingConditions.push(
          'SUM(site_categories.name IN (' + getParams(andTagCount) + ')) = ' + andTagCount
        );
    }

    if (orTagCount > 0) {
        havingConditions.push(
          'SUM(site_categories.name IN (' + getParams(orTagCount) + ')) > 0 '
        );
    }

    if (notTagCount > 0) {
        havingConditions.push(
          'SUM(site_categories.name IN (' + getParams(notTagCount) + ')) = 0 '
        );
    }

    return '' +
        'SELECT sites.* ' +
        '    FROM `sites` sites ' +
        '    INNER JOIN `bridge_site_categories` bridge ON ' +
        '        sites.id = bridge.sites_id AND ' +
        '        sites.enabled = 1 ' +
        '    INNER JOIN `site_categories` site_categories ON ' +
        '        bridge.site_categories_id = site_categories.id ' +
        '        AND ( ' +
        '            bridge.count >= 3 OR ' +
        '            bridge.score >= 1000 ' +
        '        ) ' +
        '    GROUP BY sites.id' +
        '    HAVING ' +
        havingConditions.join(' AND ') +
        '    ORDER BY -LOG(1-RAND())/(sites.power + 1) ' +
        '    LIMIT 1' +
        ';'
    ;
}
