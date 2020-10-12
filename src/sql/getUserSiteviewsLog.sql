SELECT
    _events.*, bridge.count, sites.address, eventCreator.username
    FROM `events_user_siteviews` _events
    INNER JOIN `bridge_user_siteviews` bridge ON
        bridge.id = _events.bridge_user_siteviews_id
    INNER JOIN `sites` sites ON
        sites.id = bridge.sites_id
    LEFT JOIN `users` eventCreator ON
        _events.user_id_create = eventCreator.id
    GROUP BY _events.id
    ORDER BY _events.update_date DESC
    LIMIT ? OFFSET ?
;