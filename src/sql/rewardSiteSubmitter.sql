START TRANSACTION;
    SET @siteId := ?;
    SET @pointGain := ?;

    SET @createId = (SELECT user_id_create FROM sites WHERE id = @siteId);

    UPDATE
        `users`
    SET
        total_points = total_points + @pointGain,
        current_points = current_points + @pointGain
    WHERE
        id = @createId
    ;
COMMIT;