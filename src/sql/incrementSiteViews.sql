START TRANSACTION;
    SET @user_id := ?;
    SET @site_id := ?;
    SET @points_earn := ?;

    UPDATE
        `sites`
    SET
        views = views + 1
    WHERE
        id = @site_id
    ;
    CALL update_site_power(@site_id);
    INSERT INTO `bridge_user_siteviews`
        (user_id_create, user_id_update, users_id, sites_id, count)
        values (@user_id, @user_id, @user_id, @site_id, 1)
    ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        user_id_update = @user_id,
        count = count + 1
    ;
    INSERT INTO `events_user_siteviews`
        (user_id_create, user_id_update, bridge_user_siteviews_id)
        values (@user_id, @user_id, LAST_INSERT_ID())
    /* ON DUPLICATE KEY rollback entire transaction (implicit) */
    ;
    UPDATE
        `users`
    SET
        last_site_view_date = CURRENT_TIMESTAMP,
        last_viewed_site_id = @site_id,
        rated_last_site = 0,
        flagged_last_site = 0,
        site_views = site_views + 1,
        total_points = total_points + @points_earn,
        current_points = current_points + @points_earn
    WHERE
        id = @user_id
    ;
COMMIT;