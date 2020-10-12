
UPDATE `sites`
    SET
        user_id_update = ?,
        update_date = CURRENT_TIMESTAMP,
        mod_queued = 0
    WHERE id = ?
;