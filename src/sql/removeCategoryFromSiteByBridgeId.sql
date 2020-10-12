UPDATE `bridge_site_categories`
    SET
        update_date = CURRENT_TIMESTAMP,
        user_id_update = ?,
        enabled = 0
    WHERE
        id = ?
;
