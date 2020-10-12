UPDATE `sites`
    SET
        user_id_update = ?,
        update_date = CURRENT_TIMESTAMP,
        enabled = 1
    WHERE id = ?
;