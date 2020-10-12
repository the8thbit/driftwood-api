START TRANSACTION;
    SET @admin_id := ?;
    SET @user_id := ?;
    SET @role_id := ?;

    UPDATE `bridge_user_roles`
    SET 
        enabled = 0
    WHERE
        users_id = @user_id AND
        user_roles_id = @role_id
    ;
    UPDATE `user_roles`
    SET
        update_date = CURRENT_TIMESTAMP,
        user_id_update = @admin_id,
        count = count - 1
    WHERE
        id = @role_id
    ;
COMMIT;