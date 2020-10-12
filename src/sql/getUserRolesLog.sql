SELECT
    bridge.*, roles.name, bridgeCreator.username AS admin,
    bridgeCreator.id AS admin_id, users.username, users.id AS user_id
    FROM `bridge_user_roles` bridge 
    LEFT JOIN `users` bridgeCreator ON
        bridge.user_id_create = bridgeCreator.id
    LEFT JOIN `users` users ON
        users.id = bridge.users_id
    LEFT JOIN `user_roles` roles ON
        bridge.user_roles_id = roles.id
    GROUP BY bridge.id
    ORDER BY bridge.update_date DESC
    LIMIT ? OFFSET ?
;