START TRANSACTION;
    SET @userId := ?;
    SET @pointBonus := ?;
    UPDATE
        `users`
    SET
        total_points = total_points + @pointBonus,
        current_points = current_points + @pointBonus
    WHERE
        id = @userId
    ;
COMMIT;