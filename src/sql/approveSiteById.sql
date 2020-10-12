START TRANSACTION;
    SET @adminId := ?;
    SET @siteId := ?;

    SET @isAlreadyApproved = (
        SELECT enabled FROM `sites` WHERE id = @siteId
    );

    UPDATE `sites`
        SET
            user_id_update = @adminId,
            update_date = CURRENT_TIMESTAMP,
            enabled = 1,
            protected = 1,
            mod_queued = 0
        WHERE id = @siteId
    ;
    SET @creatorId = (SELECT user_id_create FROM `sites` WHERE id = @siteId);

    UPDATE `users`
        SET
            approvals = IF(@isAlreadyApproved, approvals, approvals + 1)
        WHERE id = ?
    ;
COMMIT;