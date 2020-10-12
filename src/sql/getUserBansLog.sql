SELECT
    _events.*, bridge.count, bans.name, bans.description,
    eventCreator.username AS admin, bannedUser.username
    FROM `events_user_bans` _events
    INNER JOIN `bridge_user_bans` bridge ON
        bridge.id = _events.bridge_user_bans_id
    INNER JOIN `user_bans` bans ON
        bans.id = bridge.user_bans_id
    LEFT JOIN `users` bannedUser ON
        bannedUser.id = bridge.users_id
    LEFT JOIN `users` eventCreator ON
        _events.user_id_create = eventCreator.id
    GROUP BY _events.id
    ORDER BY _events.update_date DESC
    LIMIT ? OFFSET ?
;