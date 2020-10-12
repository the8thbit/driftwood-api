SELECT
    *
FROM
    `site_categories`
WHERE
    `name` = ? AND
    `enabled` = 1
;