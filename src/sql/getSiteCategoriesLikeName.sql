SELECT
    *
    FROM
        `site_categories`
    WHERE
        `name` LIKE ? AND
        `enabled` = 1
    ORDER BY `count` DESC
    LIMIT ?
;