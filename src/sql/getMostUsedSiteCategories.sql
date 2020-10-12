SELECT *
    FROM `site_categories`
    WHERE enabled = 1
    ORDER BY count DESC
    LIMIT ? OFFSET ?
;