UPDATE `sites`
    SET
        user_id_update = ?,
        update_date = CURRENT_TIMESTAMP,
        protected = 1
    WHERE id = ?
;