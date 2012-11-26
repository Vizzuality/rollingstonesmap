var ANIMATE_DELAY = 400;
var tour_indexes = []

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
      console.log("CHANGED");
        updateMap();
        checktimeline();
    }else{
        $('#timeline ul li a').removeClass('selected');
    }
});

$(window).resize(function() {
  $(Reveal.getCurrentSlide()).find('.content').css('top',document.body.clientHeight / 2 - ($(Reveal.getCurrentSlide()).find('.content').height() / 2));
});

// Initialize background map and create cartodb layers
var map = L.map('map', {zoomControl:false}).setView([51.998410382390325, -1.38427734375], 6);
createCartodbLayers();

// Add needed slides with their contents
$.ajax({
  url: "http://saleiva-beta.cartodb.com/api/v2/sql?q=select%20cartodb_id,%20tour_length,%20shortname,%20year,%20description%20from%20rolling_stones_tour_list%20order%20by%20first_concert_date%20asc",
})
.done(function (data) {
    try{
       data = JSON.parse(data);
    }catch(err){}
    for(var i in data.rows){
        var nextSlide = parseInt(i)+1;
        var tourL = parseInt(data.rows[i].tour_length).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        $('.slides').append('<section class="tour">'+
                '<div class="content">'+
                    '<h2 class="year">'+data.rows[i].year+'</h2>'+
                    '<h2 class="title" tour-id="'+parseInt(data.rows[i].cartodb_id,10)+'">'+data.rows[i].shortname+'</h2>'+
                    '<h2 class="description">'+data.rows[i].description+'</h2>'+
                    '<p class="km">'+tourL+'km.</p>'+
                '</div>'+
                '<div class="nextButton"><a href="#" actual-slide="'+nextSlide+'"> </a></div>'+
            '</section>'
        );
    tour_indexes.push(parseInt(data.rows[i].cartodb_id,10));
    }
});

// Binds event to the next buttons on each slide
$('.nextButton a').live('click', function(e){
    var goto = parseInt($(e.target).attr('actual-slide')) + 1;
    Reveal.slide(goto,0)
    e.preventDefault();
    return false;
});

//Creates the timeline
$.ajax({
  url: "http://saleiva-beta.cartodb.com/api/v2/sql?q=SELECT%20MIN(cartodb_id)%20as%20tour_id,year%20FROM%20rolling_stones_tour_list%20GROUP%20BY%20year%20ORDER%20BY%20year%20ASC",
})
.done(function (data){
	try{
	   data = JSON.parse(data);
	}catch(err){}
	$('#timeline ul').append('<li><span id="firstYear">'+data.rows[0].year+'</span></li>');
	for(var i in data.rows){
		$('#timeline ul').append('<li>'+
				'<a href="#" year-data="'+parseInt(data.rows[i].year)+'" go-to-data="'+parseInt(data.rows[i].tour_id,10)+'"> </a>'+
			'</li>'
		);
	};
	$('#timeline ul').append('<li><span id="lastYear">'+data.rows[data.rows.length-1].year+'</span></li>');
});

$('#timeline ul li a').live('click', function(e){
    var goto = parseInt($(e.target).attr('go-to-data'));
    Reveal.slide(searchTour(goto),0)
    e.preventDefault();
    return false;
});

$('#timeline ul li a').live('mouseover', function(e){
    var _year = $(e.target).attr('year-data');
    $('#pointTT > p.name').text(_year);
    $('#pointTT > p.date').text('');
    $('#pointTT').show();
    $('#pointTT').css({
        'left':($(e.target).offset().left + 5 - $('#pointTT').width()/2)+'px',
        'top':($(e.target).offset().top - 34) + 'px'
    });
    e.preventDefault();
    return false;
});

$('#timeline ul li a').live('mouseout', function(e){
    $('#pointTT').hide();
    e.preventDefault();
    return false;
});


// Creates cartodb needed layers
function createCartodbLayers(){
    
    // Create points layer
    cartodb.createLayer(map, 'http://saleiva-beta.cartodb.com/api/v1/viz/787/viz.json', {
        infowindow:false,
        interaction: false
    })
    .on('done', function(layer) {
        map.addLayer(layer);
    })
    .on('error', function() {
        console.log("some error occurred");
    });


    // Create points layer
    cartodb.createLayer(map, 'http://saleiva-beta.cartodb.com/api/v1/viz/789/viz.json', {
        query: "SELECT *, to_char(date, 'MM-DD-YYYY') as date_proc, ST_asGeoJson(the_geom) as geom FROM {{table_name}}",
        infowindow:false,
        interactivity: 'geom, city, cartodb_id, date_proc'
    })
    .on('done', function(layer) {
        window.pointsLayer = layer;
        map.addLayer(layer);
        
        // Handles feature over
        layer.on('featureOver', function(e, latlng, pos, data) {
            var pointLatLng = JSON.parse(data.geom);
            var ll = new L.LatLng(pointLatLng.coordinates[1], pointLatLng.coordinates[0]);
            if(!window.m){
                window.m = new L.CircleMarker(ll, {
                    radius: 6,
                    color: '#fff',
                    fillOpacity: 1,
                    stroke: false
                }).addTo(map);
            }else{
                window.m.setLatLng(ll);
            }
            $('#pointTT > p.date').text(data.date_proc);
            $('#pointTT > p.name').text(data.city);
            $('#pointTT').show();
            $('#pointTT').css({
                'left':(pos.x-$('#pointTT').width()/2)+'px',
                'top':(pos.y-55)+'px'
            });
        });

        // Handles feature out
        layer.on('featureOut', function(e, latlng, pos, data) {
            if(window.m){
                map.removeLayer(window.m);
                window.m = null;
            }
            $('#pointTT').hide();
        });

        layer.on('error', function(err) {
            console.log('error: ' + err);
        });

        // Repositions CartoDB logo and hides attributions
        setTimeout(function(){
            $('#cartodb_logo').animate({
                left: 96,
                bottom: 14
            }, 300);
            $('.leaflet-control-attribution').animate({
                opacity:0
            }, 200);
        }, 10);

    })
    .on('error', function() {
        console.log("some error occurred");
    });

    //Create lines layer
    cartodb.createLayer(map, 'http://saleiva-beta.cartodb.com/api/v1/viz/788/viz.json', {
        infowindow: false,
        interaction: false
    })
    .on('done', function(layer) {
        window.linesLayer = layer;
        map.addLayer(layer);
    })
    .on('error', function() {
        console.log("some error occurred");
    });
}

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
}

// animation
var animMarker = null;
var animPoints = null;
var animPos = 0;
var animT = 0;
function changeAnimation(data) {
  animPoints = data.features[0].geometry.coordinates[0];
  animPos = 0;
  animT = 0;
  if(!animMarker) {
    animMarker = new L.CircleMarker(new L.LatLng(0, 0), {
        radius: 6,
        color: '#fff',
        fillOpacity: 1,
        stroke: false
    }).addTo(map);
    setInterval(function() {
      animT += 0.01;
      if(animT > 1.0) {
        animPos = (animPos + 1) % (animPoints.length - 1);
        animT = 0;
      }
      var p0 = animPoints[animPos];
      var p1 = animPoints[animPos + 1];
      var lon = p0[0] + animT * (p1[0] - p0[0]);
      var lat = p0[1] + animT * (p1[1] - p0[1]);
      animMarker.setLatLng(new L.LatLng(lat, lon));
      animMarker.setStyle({fillOpacity:0.7 + 0.5*Math.cos(3*animT*Math.PI), color: '#F00'});
      //animMarker.setRadius(10
    }, 30)
  }
}
function updateMap(){
    var tour_id = $('section.present > .content > .title').attr('tour-id');
    var sql = new cartodb.SQL({user: 'saleiva-beta'});
    window.pointsLayer.setOpacity(0);
    window.linesLayer.setOpacity(0);

    sql.execute('SELECT the_geom FROM rolling_stones_tour_list WHERE cartodb_id = {{tour_id}}', {
      tour_id: tour_id
    }, {
      format: 'geojson' 
    }).done(changeAnimation);

    sql.getBounds('SELECT * FROM rolling_stones_tour_list WHERE cartodb_id={{id}}', { 
        id: tour_id 
    })
    .done(function(data) {
        var p0 = new L.LatLng(data[0][0],data[0][1]);
        var p1 = new L.LatLng(data[1][0],data[1][1]);
        var bb = new L.LatLngBounds(p0,p1);
        map.fitBounds(bb);
        setTimeout(function(){
          window.pointsLayer.setQuery("SELECT *, to_char(date, 'MM-DD-YYYY') as date_proc, ST_asGeoJson(the_geom) as geom FROM {{table_name}} WHERE tour_id="+tour_id);
          window.linesLayer.setQuery('SELECT * FROM {{table_name}} WHERE cartodb_id='+tour_id);
          window.pointsLayer.setOpacity(1);
          window.linesLayer.setOpacity(1);
        },250)
    })
    .error(function(errors) {
        console.log("error:" + err);
    })
}

function searchTour(id){
    for(i in tour_indexes){
        if(tour_indexes[i] == id){
            return (parseInt(i)+1);
        }
    }
}

 // TODO: CHECK THIS WELL
function checktimeline(){
    var _year = $("section.present > .content > .year").text();
    if(window.selectedYear != _year || !window.selectedYear){
        $('#timeline ul li a').removeClass('selected');
        $('#timeline ul li a[year-data="'+_year+'"]').addClass('selected'); 
        window.selectedYear = _year
    }
}
