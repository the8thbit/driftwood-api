SELECT
    sites.id AS site_id, users.id AS user_id,
    
    sites.address AS address, sites.create_date AS site_create_date,
    sites.update_date AS site_update_date, sites.score AS site_score,
    sites.protected AS site_protected,

    users.create_date AS user_create_date, users.username AS username,
    users.site_views AS user_site_views, users.site_adds AS user_site_adds,
    users.approvals AS user_approvals, users.total_points AS user_total_points,
    users.current_points AS user_current_points,
    users.ban_count AS user_ban_count, users.flag_count AS user_flag_count,
    users.active_flag_count AS user_active_flag_count
    FROM
        `sites` sites
    LEFT JOIN `users` users ON
        users.id = user_id_create AND
        sites.mod_queued = 1
    GROUP BY sites.id
    ORDER BY sites.create_date ASC
    LIMIT ? OFFSET ?
;