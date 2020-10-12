SELECT
    flags.id AS flag_id, bridge.id AS flag_bridge_id, _events.id AS flag_event_id,
    flagCreator.id AS flag_creator_id, sites.id AS site_id, siteCreator.id AS site_creator_id,
    
    flags.name AS flag_name, flags.priority AS flag_priority, bridge.count AS flag_count,
     _events.create_date AS flag_create_date, _events.score AS flag_score, _events.comment,

    flagCreator.username AS flag_creator_name, flagCreator.total_points AS flag_creator_score,
    flagCreator.ban_count AS flag_creator_ban_count, flagCreator.flag_count AS flag_creator_flag_count,
    flagCreator.active_flag_count AS flag_creator_active_flag_count,

    sites.address AS site_address, sites.likes AS site_likes, sites.dislikes AS site_dislikes,
    sites.views AS site_views, sites.flag_count AS site_flag_count,

    siteCreator.username AS site_creator_name, siteCreator.create_date AS site_creator_join_date,
    siteCreator.total_points AS site_creator_score, siteCreator.site_adds AS site_creator_site_adds,
    siteCreator.ban_count AS site_creator_ban_count, siteCreator.flag_count AS site_creator_flag_count,
    siteCreator.active_flag_count AS site_creator_active_flag_count
    FROM
        `events_site_flags` _events
    INNER JOIN `bridge_site_flags` bridge ON
        bridge.id = _events.bridge_site_flags_id AND
        _events.mod_queued = 1
    INNER JOIN `sites` sites ON
        sites.id = bridge.sites_id
    LEFT JOIN `users` siteCreator ON
        siteCreator.id = sites.user_id_create
    LEFT JOIN `users` flagCreator ON
        flagCreator.id = _events.user_id_create
    INNER JOIN `site_flags` flags ON
        flags.id = bridge.site_flags_id
    GROUP BY _events.id
    ORDER BY flag_creator_score DESC
    LIMIT ?
    OFFSET ?
;