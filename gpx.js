/* pseudo code
generate form POI choices from JS
display form
get form submit from user
lookup relation id on wikidata
extract osm from overpass
convert to geojson
convert to gpx
serve result to user
*/
var choiceList = [
    {
	title: "huts and shelters only",
	query: '(nwr["access"!="private"]["tourism"="alpine_hut"](area.searchArea);'+
	    'nwr["access"!="private"]["tourism"="wilderness_hut"](area.searchArea);'+
	    'nwr["access"!="private"]["amenity"="shelter"]["shelter_type"!="public_transport"]["public_transport"!~".*"]["leisure"!="bird_hide"](area.searchArea););'
    },
    {
	title: "huts, shelters, barbecues and firepits",
	query: '('+  // Start union
	    // Get barbecues
	    'nw["access"!="private"]["amenity"="bbq"](area.searchArea);'+
	    // Get firepits
	    'nw["access"!="private"]["leisure"="firepit"](area.searchArea);'+
	    // Get alpine huts
	    'nw["access"!="private"]["tourism"="alpine_hut"](area.searchArea);'+
	    // Get wilderness huts
	    'nw["access"!="private"]["tourism"="wilderness_hut"](area.searchArea);'+
	    // Get shelters <3
	    'nw["access"!="private"]["amenity"="shelter"]'+
	    // but not these kinds of shelters which are not suitable for hikers that want to sleep
	    '["shelter_type"!="public_transport"]["public_transport"!~".*"]["leisure"!="bird_hide"](area.searchArea);'+
	    ');'+  // End union
    },
    {
	title: "barbecues and firepits",
	query: '('+  // Start union
	    // Get barbecues
	    'nw["access"!="private"]["amenity"="bbq"](area.searchArea);'+
	    // Get firepits
	    'nw["access"!="private"]["leisure"="firepit"](area.searchArea);'+
	    ');'+  // End union
    },
    {
	title: "huts and shelters, chalets, apartments, B&Bs, hostels and hotels",
	query: '(nwr["tourism"~"^(hostel|apartment|camp-site|chalet|guest_house|hotel|motel)$"](area.searchArea);nwr["access"!="private"]["tourism"="alpine_hut"](area.searchArea);nwr["access"!="private"]["tourism"="wilderness_hut"](area.searchArea);nwr["access"!="private"]["amenity"="shelter"]["shelter_type"!="public_transport"]["public_transport"!~".*"]["leisure"!="bird_hide"](area.searchArea););'
    }
];
var select = $('<select>').attr("name", "choices");
var choices = $.each(choiceList, function (index, value){
    $(select).append($('<option>').attr("value", value.query).text(value.title))
})

$(document).ready(function () {
    $('#choices').append(select);
    $('#form').append(
	$('<button>').attr({"type": "submit"}).text("Generate GPX")
	    .click(function(event){
		event.preventDefault();
		//spinner();
		query();
		//spinner();
	    }));
    $('div.advanced')
	.hide()
	.append(custom);
    $('#presets').click(function(event){
	event.preventDefault();
	show_pre()});
    $('#advanced').click(function(event){
	event.preventDefault();
	show_adv()});
    $( "#area" ).autocomplete({
	// source https://w3lessons.info/autocomplete-search-using-wikipedia-api-and-jquery-ui/
        source: function(request, response) {
            $.ajax({
		url: "http://en.wikipedia.org/w/api.php",
		dataType: "jsonp",
		data: {
                    'action': "opensearch",
                    'format': "json",
                    'search': request.term
		},
		success: function(data) {
                    response(data[1]);
		}
            });
	},
	autoFocus:true,
	minLength:2,
	//delay:500
    });
});
function show_pre() {
    $('.nav-item.presets').addClass("active")
    $('.nav-item.advanced').removeClass("active")
    $('div.advanced').hide();
    $('#custom').val("")
    $('#choices').append(select);
    $('div.presets').show();
}
function show_adv() {
    $('.nav-item.presets').removeClass("active")
    $('.nav-item.advanced').addClass("active")
    $('div.presets').hide();
    $('[name="choices"]').remove()
    $('div.advanced').show();
}
function spinner() {
    if (!$('#mySpinner').hasClass('spinner')) {
	console.info('spinner started');
	$('#mySpinner').addClass('spinner');
	$('#blurbackground').addClass('blur');
    }
    else {
	console.info('spinner stopped');
	$('#mySpinner').removeClass('spinner');
	$('#blurbackground').removeClass('blur');
    }
}
function query() {
    // get form values:
    var area = $('#area').val();
    var query = $('[name="choices"]').val();
    var custom = $('#custom').val();
    if (!custom && !query)
	alert("Please fill in a custom query.");
    else if (!area)
	alert("Please type in an area.");
    else {
	// Start spinner
	spinner();
	if (!query)
	    var query = custom;
	// get osm relation id from WD
	// 1a.Parts of the url:
	wd = "https://www.wikidata.org/w/api.php?";
	wp = "https://en.wikipedia.org/w/api.php?"; // list of iso-code = ? ----------------<
	aw = "action=wbgetentities" ; // rather wdpoint
	aq = "action=query" ; // ?rather wppage
	ts = "&sites=enwiki" ; // wd only&required. // list of wiki-code = ? --------------<
	t = "&titles=" // target, wd|wp
	ps = "&props=claims" ; // wdpoint only
	p = "&prop=extracts&exintro&explaintext&exsentences=10" ; // wppage only
	r = "&redirects&converttitles" ; // wppage only
	c = "&callback=?" ;// wd|wp
	f = "&format=json" ;// wd|wp
	url_tpl = wd+aw+ts+t+ area +ps+c+f;
	console.info(url_tpl);
	$.getJSON(url_tpl, function (data) {
	})
	    .done(function (data){
		console.info(data);
		if (data["entities"].hasOwnProperty("-1")) {
		    spinner();
		    alert("No Wikipedia page with that name exist");
		}
		else {
		    // Extract the P402 relation id from the json response
		    // jq equivalent: '.entities |[.[] ] | .[0].claims.P402[0].mainsnak.datavalue.value'
		    var array = $.map(data.entities, function(value, index) {
			return [value];
		    });
		    if (!array[0].claims.hasOwnProperty("P402")) {
			console.info("no P402!");
			//console.info(array[0]);
			var ret = confirm("No OSM relation id exist for this area in Wikidata. Fix now?");
			// Stop spinner
			spinner();
			if (ret == true) {
			    var url = "https://www.wikidata.org/wiki/"+array[0].id;
			    var win = window.open(url, '_blank');
			    win.focus();
			}
			else
			    return;
		    }
		    else {
			var p402 = $.map(array[0].claims.P402, function(value, index) {
			    return [value];
			});
			var osmid = p402[0].mainsnak.datavalue.value;
			console.info('osmid: '+osmid);

			// Why 3600,000,000? It seems to be hardcoded in Overpass-API
			var areaCode = String(3600000000+Number(osmid));
			var overpassQuery = buildQuery(areaCode);
			
			function buildQuery(areaCode) {
			    var q =
				'https://overpass-api.de/api/interpreter?data=[out:xml][timeout:325];area('+areaCode+')->.searchArea;'+query+'out center;';
			    console.log(q);
			    return q;
			}
			$.get(overpassQuery, function(data) {
			    var geojson = osmtogeojson(data);
			    //console.info(geojson);
			    var gpx_str = constructGpxString(geojson);
			    //var gpx = togpx(geojson);
			    //console.info(gpx);
			    // make content downloadable as file
			    if (geojson) {
				var features = geojson.features
				//console.info(features);
				if (features === undefined || features.length == 0) {
				    spinner();
				    alert("Empty dataset returned from Overpass API.");
				}
				else {
				    var blob = new Blob([gpx_str], {
					type: "application/xml;charset=utf-8"
				    });
				    saveAs(blob, "export.gpx");
				    // Stop spinner
				    spinner();
				}
			    }
			    else
				spinner();
			}).fail(function() {
			    alert( "Error returned from Overpass API. See your browser console for details" );
			});
		    }
		};
	    });
    }
}
function constructGpxString(geojson) {
    // This function is adapted from the original at https://github.com/tyrasd/overpass-turbo/blob/b06a1f4deaefcf815c2d0c63bff6e875d2045c95/js/ide.js under MIT license.
    var appname = "OpenStreetMap GPX exporter";
    var copyright = "Data under ODbL by OpenStreetMap Contributors"
    var d  = Date.now();
    var timestamp = new Date().toISOString();
    var gpx_str;
    gpx_str = togpx(geojson, {
	creator: appname,
	metadata: {
	    desc: "Filtered OSM data converted to GPX",
	    copyright: {"@author": copyright},
	    time: timestamp
	},
	featureTitle: function(props) {
	    if (props.tags) {
		if (props.tags.name) return props.tags.name;
		if (props.tags.ref) return props.tags.ref;
		if (props.tags["addr:housenumber"] && props.tags["addr:street"])
		    return (
			props.tags["addr:street"] +
			    " " +
			    props.tags["addr:housenumber"]
		    );
	    }
	    return props.id;
	},
	//featureDescription: function(props) {},
	featureLink: function(props) {
	    return "http://osm.org/browse/" + props.id;
	}
    });
    if (gpx_str[1] !== "?")
	gpx_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + gpx_str;
    return gpx_str;
}
