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

    UPDATE `events_site_flags`
        SET
            user_id_update = @adminId,
            update_date = CURRENT_TIMESTAMP,
            mod_queued = 0
        WHERE bridge_site_flags_id = @bridgeId
    ;
COMMIT;