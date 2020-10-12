START TRANSACTION;
    SET @user_id := ?;
    SET @points := ?;
    SET @address := ?;
    SET @modQueued := ?;
    SET @enabled := ?;
    SET @protected := ?;

    INSERT INTO `sites`
        (user_id_create, user_id_update, score, address, mod_queued, enabled, protected)
    values
        (@user_id, @user_id, @points, @address, @modQueued, @enabled, @protected)
    ;
    CALL update_site_power(LAST_INSERT_ID());
    UPDATE
        `users`
    SET
        last_site_add_date = CURRENT_TIMESTAMP,
        site_adds = site_adds + 1,
        current_points = IF(current_points >= 50, current_points - 50, 0)
    WHERE
        id = @user_id
    ;
COMMIT;