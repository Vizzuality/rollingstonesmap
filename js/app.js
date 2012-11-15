
var ANIMATE_DELAY = 400;

var slideIndex = 0;

// Full list of configuration options available here:
// https://github.com/hakimel/reveal.js#configuration
Reveal.initialize({
	controls: false,
	progress: true,
	history: true,
	transition: 'linear'
});

Reveal.addEventListener('slidechanged', function(event) {
		animateContent(event);
	if(event.indexh>0){
		updateMap();
	}
});

$('#pointTT').hide();

// Initializes the bkg map
var map = L.map('map', {zoomControl:false}).setView([51.998410382390325, -1.38427734375], 6);

L.tileLayer('http://a.tiles.mapbox.com/v3/saleiva.map-73mv164v/{z}/{x}/{y}.png64').addTo(map);

cartodb.createLayer(map, 'http://staging20.cartodb.com/api/v1/viz/480/viz.json')
.on('done', function(layer) {

	window.pointsLayer = layer;
	map.addLayer(layer);
	layer.setOptions({
		query: 'SELECT *, ST_asGeoJson(the_geom) as geom FROM {{table_name}}',
		interactivity: ['geom','city']
	})
	var m;

	layer.on('featureOver', function(e, latlng, pos, data) {
		var p = JSON.parse(data.geom);
		var ll = new L.LatLng(p.coordinates[1], p.coordinates[0]);
		if(!m){
			m = new L.CircleMarker(ll, {radius: 6, color: '#fff', fillOpacity: 1, stroke: false}).addTo(map);
		}else{
			m.setLatLng(ll);
		}
		$('#pointTT > p').text(data.city);
		$('#pointTT').show();
		$('#pointTT').css({
			'left':(pos.x-$('#pointTT').width()/2)+'px',
			'top':(pos.y-40)+'px'
		});
		olde = e;
	});

	layer.on('featureOut', function(e, latlng, pos, data) {
		if(m){
			map.removeLayer(m);
			m = null;
		}
		$('#pointTT').hide();
	});

	layer.on('error', function(err) {
		console.log('error: ' + err);
	});

	setTimeout(function(){
		console.log('positioning');
		$('#cartodb_logo').animate({
			left: 96,
			bottom: 14
		}, 500);
		$('.leaflet-control-attribution').animate({
			opacity:0
		}, 300);
	}, 10);

}).on('error', function() {
	console.log("some error occurred");
});


cartodb.createLayer(map, 'http://staging20.cartodb.com/api/v1/viz/484/viz.json', {infowindow: false})
.on('done', function(layer) {
	window.linesLayer = layer;
	map.addLayer(layer);
}).on('error', function() {
	console.log("some error occurred");
});

// Add needed slides with their contents
$.ajax({
  url: "http://staging20.cartodb.com/api/v2/sql?q=select%20cartodb_id,%20tour_length,%20shortname,%20year,%20description%20from%20rolling_stones_tour_list%20order%20by%20first_concert_date%20asc",
}).done(function (data) {
	for(var i in data.rows){
		var nextSlide = parseInt(i)+1;
		var tourL = parseInt(data.rows[i].tour_length).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		$('.slides').append('<section class="tour">'+
				'<div class="content">'+
					'<h2 class="year">'+data.rows[i].year+'</h2>'+
					'<h2 class="title" tour-id="'+parseInt(data.rows[i].cartodb_id,10)+'">'+data.rows[i].shortname+'</h2>'+
					'<h2 class="description">'+data.rows[i].description+'</h2>'+
					'<p class="km">'+tourL+'</p>'+
				'</div>'+
				'<div class="nextButton"><a href="#" actual-slide="'+nextSlide+'"> </a></div>'+
			'</section>'
		);
	}  
});

$('.nextButton a').live('click', function(e){
	var goto = parseInt($(e.target).attr('actual-slide')) + 1;
	Reveal.slide(goto,0)
	e.preventDefault();
	return false;
});

// Animate and position the content when loading a new slide
function animateContent(event){
	$(event.currentSlide).find('.content').css('top',document.body.clientHeight / 2 - ($(event.currentSlide).find('.content').height() / 2));
	if((event.indexh) > 0){
		$(event.currentSlide).find('.content').delay(ANIMATE_DELAY).animate({opacity: 1}, 1000);
		$(event.currentSlide).find('.nextButton').delay(ANIMATE_DELAY).animate({opacity: 1}, 1000);
	}else{
		$(event.currentSlide).find('.nextButton').delay(ANIMATE_DELAY).animate({opacity: 1}, 1000);
	}
	$(event.previousSlide).find('.content').delay(ANIMATE_DELAY*2).animate({opacity: 0}, 100);
	$(event.previousSlide).find('.nextButton').delay(ANIMATE_DELAY*2).animate({opacity: 0}, 100);
	slideIndex = event.indexh;
}

function updateMap(){
	var tour_id = $('section.present > .content > .title').attr('tour-id');
	window.pointsLayer.setQuery('SELECT *, ST_asGeoJson(the_geom) as geom FROM {{table_name}} WHERE tour_id='+tour_id);
	window.linesLayer.setQuery('SELECT * FROM {{table_name}} WHERE cartodb_id='+tour_id);
	var sql = new cartodb.SQL({ user: 'staging20' });
	sql.getBounds('SELECT * FROM rolling_stones_tour_list WHERE cartodb_id={{id}}', { id: tour_id })
  		.done(function(data) {
			var p0 = new L.LatLng(data[0][0],data[0][1]);
			var p1 = new L.LatLng(data[1][0],data[1][1]);
  			var bb = new L.LatLngBounds(p0,p1);
   			map.fitBounds(bb);
 	 	})
		.error(function(errors) {
    		// errors contains a list of errors
    		console.log("error:" + err);
		})
}