SELECT *
    FROM `users`
    WHERE id != 0
    ORDER BY site_adds DESC
    LIMIT ? OFFSET ?
;