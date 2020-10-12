SELECT categories.* FROM `site_categories` categories
    INNER JOIN `bridge_site_categories` bridge ON
        categories.id = bridge.site_categories_id AND
        categories.enabled = 1 AND
        bridge.enabled = 1
    INNER JOIN `users` users ON
        bridge.user_id_create = users.id AND
        categories.name LIKE ? AND (
            users.total_points > 100 OR
            categories.admin_create = 1
        )
    GROUP BY categories.id
    HAVING 
        COUNT(DISTINCT bridge.user_id_create) >= 3 OR
        categories.admin_create = 1
    ORDER BY categories.count DESC
    LIMIT ?
;