SELECT *
    FROM `users`
    WHERE id != 0
    ORDER BY total_points DESC
    LIMIT ? OFFSET ?
;