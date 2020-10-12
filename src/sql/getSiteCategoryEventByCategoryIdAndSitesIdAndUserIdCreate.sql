SELECT _events.*
    FROM `events_site_categories` _events
    INNER JOIN `bridge_site_categories` bridge ON
        _events.bridge_site_categories_id = bridge.id AND
        bridge.site_categories_id = ? AND
        bridge.sites_id = ? AND
        bridge.enabled = 1
    INNER JOIN `site_categories` categories ON
        bridge.site_categories_id = categories.id AND
        categories.enabled = 1
    GROUP BY
        _events.id
    HAVING
        _events.user_id_create = ?
;