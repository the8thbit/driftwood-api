SELECT * FROM `sites`
    WHERE enabled = 1
    ORDER BY -LOG(1-RAND())/(power + 1)
    LIMIT 1
;