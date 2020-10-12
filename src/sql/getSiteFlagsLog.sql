SELECT 
    _events.*, sites.id AS site_id, sites.address, bridge.count, flags.name,
    siteCreator.id AS site_creator_id,
    siteCreator.username AS site_creator_username,
    eventCreator.id AS user_id, eventCreator.username
    FROM `events_site_flags` _events
    INNER JOIN `bridge_site_flags` bridge ON
        bridge.id = _events.bridge_site_flags_id
    INNER JOIN `site_flags` flags ON
        flags.id = bridge.site_flags_id
    INNER JOIN `sites` sites ON
        sites.id = bridge.sites_id
    LEFT JOIN `users` eventCreator ON
        _events.user_id_create = eventCreator.id
    LEFT JOIN `users` siteCreator ON
        sites.user_id_create = siteCreator.id
    GROUP BY _events.id
    ORDER BY _events.update_date DESC
    LIMIT ? OFFSET ?
;