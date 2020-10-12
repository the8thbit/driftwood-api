SELECT *
    FROM `sites` sites
    WHERE
        (CAST(likes AS FLOAT) + 1.0)/(CAST(dislikes AS FLOAT) + 1.0) <= 1.5 AND
        (CAST(dislikes AS FLOAT) + 1.0)/(CAST(likes AS FLOAT) + 1.0) <= 1.5
    ORDER BY views DESC
    LIMIT ? OFFSET ?
;