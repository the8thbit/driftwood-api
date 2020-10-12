SELECT 
    categories.*, users.username, users.ban_count AS creator_ban_count,
    users.flag_count AS creator_flag_count,
    users.active_flag_count AS creator_active_flag_count,
    users.approvals AS creator_approvals, users.total_points AS creator_total_points,
    users.current_points AS creator_current_points
    FROM `site_categories` categories
    LEFT JOIN `users` users ON
        categories.user_id_create = users.id AND
        categories.enabled = 1
    GROUP BY categories.id
    ORDER BY categories.create_date DESC
    LIMIT ? OFFSET ?
;