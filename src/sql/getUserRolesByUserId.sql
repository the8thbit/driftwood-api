SELECT roles.name
    FROM `bridge_user_roles` bridge
    INNER JOIN `user_roles` roles ON
        bridge.user_roles_id = roles.id AND
        bridge.users_id = ? AND
        roles.enabled = 1 AND 
        bridge.enabled = 1
    GROUP BY
        roles.id
;