UPDATE `users`
    SET
        last_site_rate_date = CURRENT_TIMESTAMP,
        update_date = CURRENT_TIMESTAMP,
        rated_last_site = 1
    WHERE id = ?
;