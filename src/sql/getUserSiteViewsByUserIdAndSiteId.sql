SELECT
    *
FROM
    `bridge_user_siteviews`
WHERE
    `users_id` = ? AND
    `sites_id` = ?
;