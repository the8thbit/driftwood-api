UPDATE `sites`
    SET
        user_id_update = ?,
        update_date = CURRENT_TIMESTAMP,
        enabled = 0
    WHERE id = ?
;