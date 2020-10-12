START TRANSACTION;
    SET @adminId := ?;
    SET @eventId := ?;

    SET @bridgeId = (
        SELECT bridge.id
        FROM `bridge_site_flags` bridge
        INNER JOIN `events_site_flags` _events ON 
            bridge.id = _events.bridge_site_flags_id AND
            _events.id = @eventId
        GROUP BY bridge.id
    );
    SET @siteFlagsId = (
        SELECT flags.id
        FROM `site_flags` flags
        INNER JOIN `bridge_site_flags` bridge ON 
            flags.id = bridge.site_flags_id AND
            bridge.id = @bridgeId
        GROUP BY flags.id
    );
    SET @sitesId = (
        SELECT sites.id
        FROM `sites` sites
        INNER JOIN `bridge_site_flags` bridge ON 
            sites.id = bridge.sites_id AND
            bridge.id = @bridgeId
        GROUP BY sites.id
    );
    SET @siteCreatorId = (
        SELECT users.id
        FROM `users` users
        INNER JOIN `sites` sites ON 
            sites.user_id_create = users.id AND
            sites.id = @sitesId
        GROUP BY users.id
    );
    SET @flagCount = (
        SELECT COUNT(*)
        FROM `events_site_flags`
        WHERE
            bridge_site_flags_id = @bridgeId AND
            enabled = 1
    );

    UPDATE `events_site_flags`
        SET
            user_id_update = @adminId,
            update_date = CURRENT_TIMESTAMP,
            enabled = 0
        WHERE bridge_site_flags_id = @bridgeId
    ;

    UPDATE `bridge_site_flags`
        SET
            user_id_update = @adminId,
            update_date = CURRENT_TIMESTAMP,
            active_count = active_count - @flagCount
        WHERE id = @bridgeId
    ;
    UPDATE `site_flags`
        SET
            user_id_update = @adminId,
            update_date = CURRENT_TIMESTAMP,
            active_count = active_count - @flagCount
        WHERE id = @flagsId
    ;
    UPDATE `sites`
        SET
            user_id_update = @adminId,
            update_date = CURRENT_TIMESTAMP,
            active_flag_count = active_flag_count - @flagCount
        WHERE id = @sitesId
    ;
    UPDATE `users`
        SET
            update_date = CURRENT_TIMESTAMP,
            active_flag_count = active_flag_count - @flagCount
        WHERE id = @siteCreatorId
    ;
COMMIT;