UPDATE `sites`
    SET
        user_id_update = ?,
        update_date = CURRENT_TIMESTAMP,
        protected = 0
    WHERE id = ?
;