SELECT
    _events.*, sites.id AS sites_id, sites.address, bridge.id AS bridge_id,
    bridge.count, bridge.enabled AS bridge_enabled, categories.name,
    categories.id AS category_id, categories.enabled AS category_enabled,
    eventCreator.username
    FROM `events_site_categories` _events
    INNER JOIN `bridge_site_categories` bridge ON
        bridge.id = _events.bridge_site_categories_id
    INNER JOIN `site_categories` categories ON
        categories.id = bridge.site_categories_id
    INNER JOIN `sites` sites ON
       sites.id = bridge.sites_id
    INNER JOIN `users` eventCreator ON
        _events.user_id_create = eventCreator.id
    GROUP BY _events.id
    ORDER BY _events.update_date DESC
    LIMIT ? OFFSET ?
;