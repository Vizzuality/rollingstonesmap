var ANIMATE_DELAY = 400;
var tour_indexes = []

// Full list of configuration options available here:
// https://github.com/hakimel/reveal.js#configuration
Reveal.initialize({
    controls: false,
    progress: true,
    history: true,
    overview: false,
    loop: true,
    transition: 'linear'
});

Reveal.addEventListener('slidechanged', function(event) {
    animateContent(event);
    if(event.indexh>0){
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
  url: "http://saleiva.cartodb.com/api/v2/sql?q=select%20cdb_id,%20tour_length,%20shortname,%20year,%20description%20from%20rolling_stones_tours%20order%20by%20first_concert_date%20asc"
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
                    '<h2 class="title" tour-id="'+parseInt(data.rows[i].cdb_id,10)+'">'+data.rows[i].shortname+'</h2>'+
                    '<h2 class="description">'+data.rows[i].description+'</h2>'+
                    '<p class="km">'+tourL+'km.</p>'+
                '</div>'+
                '<div class="nextButton"><a href="#" actual-slide="'+nextSlide+'"> </a></div>'+
            '</section>'
        );
        tour_indexes.push(parseInt(data.rows[i].cdb_id,10));
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
  url: "http://saleiva.cartodb.com/api/v2/sql?q=SELECT%20MIN(cdb_id)%20as%20tour_id,year%20FROM%20rolling_stones_tours%20GROUP%20BY%20year%20ORDER%20BY%20year%20ASC",
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
    
	//TODO: REMOVE HARDCODED NUMBERS 
    if($(e.target).is($('#timeline ul li:nth-child(2) a'))){
    	$('#timeline ul li span#firstYear').addClass('selected');
    }else if($(e.target).is($('#timeline ul li:nth-child(22) a'))){
		$('#timeline ul li span#lastYear').addClass('selected');
    }else{
	    var _year = $(e.target).attr('year-data');
	    $('#pointTT > p.name').text(_year);
	    $('#pointTT > p.date').text('');
	    $('#pointTT').show();
	    $('#pointTT').css({
	        'left':($(e.target).offset().left + 5 - $('#pointTT').width()/2)+'px',
	        'top':($(e.target).offset().top - 34) + 'px'
	    });
	}
    e.preventDefault();
    return false;
});

//TODO: REMOVE HARDCODED DATES
$('#timeline ul li a').live('mouseout', function(e){
    $('#pointTT').hide();
    if(window.selectedYear != '1963'){
    	$('#timeline ul li span:contains(1963)').removeClass('selected');
    }
    if(window.selectedYear != '2005'){
    	$('#timeline ul li span:contains(2005)').removeClass('selected');
    }
    e.preventDefault();
    return false;

});


function createCartodbLayers() {

    var baseLayerDef = {
      sql: "SELECT * FROM rolling_basemap",
      cartocss: "#rolling_basemap { polygon-fill:#333333; polygon-opacity: 0.7; line-opacity:1; line-color: #000; line-width: .3; [feature='Urban Area']{ polygon-fill:#000; polygon-opacity:0; line-width: 0; } }"
    };

    var pointsLayerDef = {
      sql: "SELECT *, date as date_proc, ST_asGeoJson(the_geom) as geom FROM rolling_stones",
      cartocss: "#rolling_stones::oth { marker-fill: #000; marker-opacity: .3; marker-width: 17; marker-allow-overlap: true; } #rolling_stones { marker-fill: #FFF; marker-opacity: 1; marker-width: 5; marker-line-width: 0; marker-placement: point; marker-type: ellipse; marker-allow-overlap: true; }",
      interactivity: 'geom,city,cartodb_id,date_proc'
    };

    var linesLayerDef = {
      sql: "select * from rolling_stones_tours",
      cartocss: "#rolling_stones_tours{ line-width: 1; line-color: #FFF; line-opacity: 0.8; }",
    };

    cartodb.createLayer(map, {
      user_name: 'saleiva',
      type: 'cartodb',
      sublayers: [
        baseLayerDef,
        pointsLayerDef,
        linesLayerDef
      ]
    }).on('done', function(layer) {
      // layer created, add it to the map
      map.addLayer(layer);

      var pointsLayer = window.pointsLayer = layer.getSubLayer(1); //second one, 0 based index
      pointsLayer.setInteraction(true);
      window.linesLayer = layer.getSubLayer(2);

      // Handles feature over
      pointsLayer.on('featureOver', function(e, latlng, pos, data) {
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
      pointsLayer.on('featureOut', function(e, latlng, pos, data) {
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

    }).on('error', function(err) {
          console.log('error: ' + err);
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

function updateMap(){
    var tour_id = $('section.present > .content > .title').attr('tour-id');
    var sql = new cartodb.SQL({user: 'saleiva'});
    window.pointsLayer.setSQL("SELECT *, date as date_proc, ST_asGeoJson(the_geom) as geom FROM rolling_stones WHERE tour_id="+tour_id);
    window.linesLayer.setSQL('SELECT * FROM rolling_stones_tours WHERE cdb_id='+tour_id);

    sql.getBounds('SELECT * FROM rolling_stones_tours WHERE cdb_id={{id}}', { 
        id: tour_id 
    })
    .done(function(data) {
        var p0 = new L.LatLng(data[0][0],data[0][1]);
        var p1 = new L.LatLng(data[1][0],data[1][1]);
        var bb = new L.LatLngBounds(p0,p1);
        map.fitBounds(bb);
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

function checktimeline(){
    var _year = $("section.present > .content > .year").text();
    if(window.selectedYear != _year || !window.selectedYear){
    	window.selectedYear = _year;
        $('#timeline ul li a').removeClass('selected');
        $('#timeline ul li span').removeClass('selected');
        $('#timeline ul li a[year-data="'+_year+'"]').addClass('selected'); 
        $('#timeline ul li span:contains("'+window.selectedYear+'")').addClass('selected');
    }
}
