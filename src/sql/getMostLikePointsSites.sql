SELECT *
    FROM `sites`
    ORDER BY like_points DESC
    LIMIT ? OFFSET ?
;