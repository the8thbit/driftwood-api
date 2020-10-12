SELECT bridge.*, bans.name
    FROM `user_bans` bans
    INNER JOIN `bridge_user_bans` bridge ON
        bans.id = bridge.user_bans_id AND
        bridge.users_id = ? AND
        bans.enabled = 1 AND
        bridge.enabled = 1 AND (
            bridge.expiration_date > CURRENT_TIMESTAMP OR
            bridge.expiration_date IS NULL
        )
;