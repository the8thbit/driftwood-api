SELECT *
    FROM `site_categories`
    WHERE enabled = 1
    ORDER BY points DESC
    LIMIT ? OFFSET ?
;