START TRANSACTION;
    SET @siteId := ?;
    SET @pointLoss := ?;

    SET @createId = (SELECT user_id_create FROM sites WHERE id = @siteId);

    UPDATE
        `users`
    SET
        current_points = if(
            current_points >= @pointLoss,
            current_points - @pointLoss,
            0
        )
    WHERE
        id = @createId
    ;
COMMIT;