SELECT *
    FROM `sites` sites
    ORDER BY likes DESC
    LIMIT ? OFFSET ?
;