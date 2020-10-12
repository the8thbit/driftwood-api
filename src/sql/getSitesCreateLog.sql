SELECT 
    sites.*,
    users.username,
    users.ban_count AS creator_ban_count,
    users.flag_count AS creator_flag_count,
    users.active_flag_count AS creator_active_flag_count,
    users.approvals AS creator_approvals,
    users.total_points AS creator_total_points,
    users.current_points AS creator_current_points
    FROM `sites` sites
    LEFT JOIN `users` users ON
        sites.user_id_create = users.id AND
        sites.enabled = 1
    GROUP BY sites.id
    ORDER BY sites.create_date DESC
    LIMIT ? OFFSET ?
;