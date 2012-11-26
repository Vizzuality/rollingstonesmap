
CREATE LINES
UPDATE rolling_stones_tour_list as r SET the_geom = (SELECT ST_Makeline(the_geom ORDER BY date) FROM rolling_stones as s WHERE r.cartodb_id=s.tour_id)