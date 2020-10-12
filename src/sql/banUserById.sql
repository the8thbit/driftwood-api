START TRANSACTION;
    SET @userId := ?;
    SET @userIdToBan := ?;
    SET @banId := ?;
    SET @banExpDate := STR_TO_DATE(?, '%d/%m/%Y %H:%i:%s');
    SET @banReason := ?;

    UPDATE `users`
        SET
            approvals = 0,
            ban_count = ban_count + 1
        WHERE
            id = @userIdToBan
    ;

    UPDATE `user_bans`
        SET
            user_id_update = @userId,
            count = count + 1
        WHERE
            id = @banId
    ;

    INSERT INTO `bridge_user_bans`
        (user_id_create, user_id_update, user_bans_id, users_id, count, expiration_date, reason)
        values (@userId, @userId, @banId, @userIdToBan, 1, @banExpDate, @banReason)
    ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        user_id_update = @userId,
        count = count + 1,
        expiration_date = IF(
            expiration_date < @banExpDate && @banExpDate IS NOT NULL,
            @banExpDate,
            expiration_date
        ),
        reason = IF(
            @banReason IS NOT NULL,
            @banReason,
            reason
        )
    ;

    INSERT INTO `events_user_bans`
        (user_id_create, user_id_update, bridge_user_bans_id, expiration_date)
        values (@userId, @userId, LAST_INSERT_ID(), @banExpDate)
    ;
COMMIT;