START TRANSACTION;
    SET @user_id = ?;
    SET @points = ?;
    SET @sites_id = ?;

    UPDATE `sites`
        SET
            user_id_update = @user_id,
            dislikes = dislikes + 1,
            dislike_points = dislike_points + @points
        WHERE id = @sites_id
    ;
    UPDATE `users`
        SET
            last_site_rate_date = CURRENT_TIMESTAMP,
            update_date = CURRENT_TIMESTAMP,
            rated_last_site = 1
        WHERE id = @user_id
    ;
    CALL update_site_power(@sites_id);
COMMIT;