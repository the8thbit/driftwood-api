START TRANSACTION;
    SET @userId := ?;
    SET @pointLoss := ?;
    UPDATE
        `users`
    SET
        current_points = if(
            current_points >= @pointLoss,
            current_points - @pointLoss,
            0
        )
    WHERE
        id = @userId
    ;
COMMIT;