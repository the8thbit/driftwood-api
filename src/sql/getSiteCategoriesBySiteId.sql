SELECT 
    bridge.id AS bridge_id, bridge.user_id_create AS bridge_creator,
    categories.* 
    FROM `site_categories` categories
    INNER JOIN `bridge_site_categories` bridge ON 
        categories.id = bridge.site_categories_id AND
        bridge.sites_id = ? AND
        bridge.enabled = 1 AND
        categories.enabled = 1
    GROUP BY categories.id
    ORDER BY categories.count DESC
    LIMIT ? OFFSET ?
;