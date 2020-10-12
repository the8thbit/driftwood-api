START TRANSACTION;
    SET @admin_id := ?;
    SET @user_id := ?;
    SET @role_id := ?;

    INSERT INTO `bridge_user_roles`
        (user_id_create, user_id_update, users_id, user_roles_id)
    values
        (@admin_id, @admin_id, @user_id, @role_id)
    ON DUPLICATE KEY UPDATE
        update_date = CURRENT_TIMESTAMP,
        user_id_update = @admin_id,
        enabled = 1
    ;
    UPDATE
        `user_roles`
    SET
        update_date = CURRENT_TIMESTAMP,
        user_id_update = @admin_id,
        count = count + 1
    WHERE
        id = @role_id
    ;
COMMIT;