;

var markers = {},
    mapcluster,
    userStorage = JSON.parse(localStorage.getItem('bookListId'));
    bookListId = userStorage || [],
    cont = $('.result-cont'),
    sortType = $('.sort-rate.active').attr('data-rate'),
    searchValue = '';
var timeoutHandler;
var map,
    bricks,
    availableBoxListings = [];

    if (userStorage == null) {
        localStorage.setItem('bookListId', JSON.stringify(bookListId));
    }

function initMap(lat, lng, zoom) {
    jQuery(document).trigger('initMap', [lat, lng, zoom]);
}

function changecolor(id) {
    var marker = markers[id];
    var cluster = mapcluster.getVisibleParent(marker);
    if (cluster && cluster != marker) {
        $(cluster._icon).find("div.cluster-wrapper").css("background-color", "#d20202");
        $(cluster._icon).find("div.cluster-wrapper i").css("color", "#d20202");
        $(cluster._icon).find("div.cluster-wrapper i div").css("background-color", "#d20202");
    }

    $("#" + id).attr('class', 'trianglehover');
    return null;
}


function returncolor(id) {
    var marker = markers[id];
    var cluster = mapcluster.getVisibleParent(marker);
    if (cluster && cluster != marker) {
        $(cluster._icon).find("div.cluster-wrapper i").css("color", "#d20202");
        mapcluster.refreshClusters(marker);
    }

    $("#" + id).attr('class', 'triangle');
    return null;
}

function bookList(id) {
    var el = $('[data_house="' + id + '"]'),
        find;
    el.toggleClass('active');
    if (el.hasClass('active')) {
        if ([].indexOf) {
            find = bookListId.indexOf(id);
        } else {
            for (var i = 0; i < bookListId.length; i++) {
                if (bookListId[i] === id) {
                    find = i;
                } else {
                    find = -1;
                }
            }
        }

        if (find == -1) {
            bookListId.push(id);
            localStorage.setItem('bookListId', JSON.stringify(bookListId));
        }
    } else {
        if ([].indexOf) {
            find = bookListId.indexOf(id);
        } else {
            for (var i = 0; i < bookListId.length; i++) {
                if (bookListId[i] === id) {
                    find = i;
                } else {
                    find = -1;
                }
            }
        }

        if (find != -1) {
            bookListId.splice(find, 1);
            localStorage.setItem('bookListId', JSON.stringify(bookListId));
        }
    }

    if (bookListId.length == 0) {
        $('.book_viewing').removeClass('items');
    } else {
        $('.book_viewing').addClass('items');
    }
}

function openSuperBigPopoup (x) {
    var popupId = x,
        lat = 0,
        lon = 0;

    scrollLock.hide($('html, body'));
    $('html, body').css({
        'overflow': 'hidden'
    });

    document.activeElement.blur();

    scrollLock.show($('.pop-content-wrapper'));

    $.ajax({
        type: "POST",
        url: "/engine/popup.php",
        data: {
            'popupId': popupId,
        },
        dataType: "json",
        success: function(data){
            if (data){
                window.history.pushState("", "", '?listing-id=' + data.data[0].qz);

                if ($('.cluster-popup-more-wrapper').length) {
                    $('.cluster-popup-more-wrapper').remove();
                }

                var c = document.createElement("div"),
                    galerry;

                c.className = "cluster-popup-more-wrapper d-flex flex-column";
                c.innerHTML = data.html.join("");

                document.body.appendChild(c);

                galerry = document.querySelector('.cluster-popup-carousel-thumb');

                var images = '';
                if (data.data[0].qz) {
                    for (var i = 1; i <= data.data[0].uz; i++) {
                        images += '<div class="item"><img data-item="' + i + '" data-thumb="<img src=\'https://www.homeads.ca/img/' + data.data[0].qz + '_' + i + '.jpg\'>" src="https://www.homeads.ca/img/' + data.data[0].qz + '_' + i + '.jpg"></div>';
                    }
                    galerry.innerHTML = images;
                }

                $('.cluster-popup-closer').on('click', function() {
                    window.history.pushState("", "", decodeURIComponent(window.location.href.replace(window.location.search, "")));
                    $('body .cluster-popup-more-wrapper').remove();
                    scrollLock.show($('html, body'));
                    $('html, body').css({
                        'overflow': 'initial'
                    });
                    return false;
                });

                $('.cluster-popup-carousel i').on('click', function() {
                    bookList($(this).attr('data_house'));
                });

                $('.cluster-popup-carousel .prev').on('click', function () {
                    var index = +$('.cluster-popup-carousel img').attr('data_item') - 1;

                    $('.cluster-popup-carousel .image-wrapper img').remove();

                    if (index == 0) index = $('.cluster-popup-carousel-thumb').find('img').last().attr('data-item');
                    $('.cluster-popup-carousel .image-wrapper').append(
                        $('<img>', {
                            src: $('.cluster-popup-carousel-thumb').find('img[data-item="' + index + '"]').attr('src'),
                            data_item: $('.cluster-popup-carousel-thumb').find('img[data-item="' + index + '"]').attr('data-item')
                        })
                    );
                    $('.cluster-popup-carousel-thumb').trigger('to.owl.carousel', [index - 1]);
                });

                $('.cluster-popup-carousel .next').on('click', function () {
                    var index = +$('.cluster-popup-carousel .image-wrapper img').attr('data_item'),
                        lastIndex = +$('.cluster-popup-carousel-thumb').find('img').last().attr('data-item') + 1;

                    if (index !== lastIndex + 1) {
                        index++;
                    }

                    $('.cluster-popup-carousel .image-wrapper img').remove();

                    if (index == lastIndex) index = 1;
                    $('.cluster-popup-carousel .image-wrapper').append(
                        $('<img>', {
                            src: $('.cluster-popup-carousel-thumb').find('img[data-item="' + index + '"]').attr('src'),
                            data_item: $('.cluster-popup-carousel-thumb').find('img[data-item="' + index + '"]').attr('data-item')
                        })
                    );

                $('.cluster-popup-carousel-thumb').trigger('to.owl.carousel', [index - 1]);
                });

                $(".cluster-popup-carousel .image-wrapper").swipe( {
                    swipeLeft:function(event, direction, distance, duration, fingerCount) {
                        $('.cluster-popup-carousel .next').trigger('click');
                    },

                    swipeRight:function(event, direction, distance, duration, fingerCount) {
                        $('.cluster-popup-carousel .prev').trigger('click');
                    },
                    threshold:0
                });

                $('.cluster-popup-carousel-map-button').on('click', function(e) {
                    if ($(e.target).attr('type') === 'map') {
                        $('#item-map').css({zIndex: 901});
                        $(e.target).html('images');
                        $(e.target).attr('type', 'images');
                    } else {
                        $('#item-map').css({zIndex: 899});
                        $(e.target).html('map');
                        $(e.target).attr('type', 'map');
                    }
                });

                $('.cluster-popup-carousel-thumb').owlCarousel({
                    loop: false,
                    margin: 10,
                    responsiveClass:true,
                    nav:true,
                    dots: false,
                    navText: ["<i class='mdi mdi-chevron-left'></i>", "<i class='mdi mdi-chevron-right'></i>"],
                    responsive:{
                        0:{
                            items:2,
                        },
                        400:{
                            items:3,
                        },
                        600:{
                            items:4,
                        },
                        1000:{
                            items:5,
                        }
                    }
                }).trigger('refresh.owl.carousel');

                $('.cluster-popup-carousel .image-wrapper').append(
                    $('<img>', {
                        src: $('.cluster-popup-carousel-thumb').find('img').attr('src'),
                        data_item: $('.cluster-popup-carousel-thumb').find('img').attr('data-item')
                    }),
                );

                if ($('.cluster-popup-carousel-thumb img').length !== 1 && $('.cluster-popup-carousel-thumb img').length !== 0) {
                    $('.cluster-popup-carousel .prev, .cluster-popup-carousel .next').removeClass('disabled');
                }

                $('.cluster-popup-carousel-thumb .item img').on('click', function (e) {
                    $('.cluster-popup-carousel img').remove();
                    $('.cluster-popup-carousel .image-wrapper').append(
                        $('<img>', {
                            src: $(e.target).attr('src'),
                            data_item: $(e.target).attr('data-item')
                        })
                    );
                    if (!($('.cluster-popup-carousel-map-button').attr('type') === 'map')) {
                        $('#item-map').css({zIndex: 899});
                        $('.cluster-popup-carousel-map-button').html('map');
                        $('.cluster-popup-carousel-map-button').attr('type', 'map');
                    }
                    return false;
                });

                $('.acordion-wrapper h4').on('click', function () {
                    $(this).toggleClass('active');
                    if ($(this).siblings('.content').hasClass('active')) {
                        $(this).siblings('.content').removeClass('active').slideUp(100);
                    } else {
                        $(this).siblings('.content').addClass('active').slideDown(100);
                    }
                });

                $('[data-metres]').on('click', function () {
                    var eLength = $('[data-type="ft-metres"]').length;
                    for (var i = eLength; i >= 0; i-- ) {
                        if ($($('[data-type="ft-metres"]')[i]).hasClass('hidden')){
                            $($('[data-type="ft-metres"]')[i]).removeClass('hidden');
                        } else {
                            $($('[data-type="ft-metres"]')[i]).addClass('hidden');
                        }
                    }
                });


                if (window.innerWidth > 768) {
                    $('.cluster-popup-carousel .image-wrapper').on('click', function(e) {
			console.log("working");
                        var x = document.createElement("div");
                        x.className = "carousel-wrap";
                        x.innerHTML = images;

                        $('.gallery-popup').addClass('active').removeClass('hidden');

                        $('.gallery-popup').append(x);


                        $('.carousel-wrap').owlCarousel({
                            loop: false,
                            margin: 10,
                            responsiveClass:true,
                            nav:true,
                            dots: false,
                            navText: ["<i class='mdi mdi-chevron-left'></i>", "<i class='mdi mdi-chevron-right'></i>"],
                            responsive:{
                                0:{
                                    items:1,
                                },
                                1000:{
                                    items:1,
                                }
                            }
                        }).trigger('refresh.owl.carousel').trigger('to.owl.carousel', [+$(e.target).attr('data_item') - 1, 0]) ;

                        $('.gallery-popup.active i.mdi-close-box-outline').on('click', function() {
                            $('.gallery-popup').removeClass('active').addClass('hidden');
                            $('.carousel-wrap').remove();
                        });

                    });
                }

                var marker = L.marker([data.data[0].wz, data.data[0].ez],  {
                    icon: new L.DivIcon({
                        className: 'tooltips',
                        iconAnchor: [43, 32],
                        shadowSize:   [0, 0],
                        shadowAnchor: [0, 0],
                        popupAnchor:  [3, 6],
                        html: '' +
                        '<div class="triangle" id="' + data.data[0].qz + '"><strong>$' + data.data[0].rz + '</strong></div>'
                    })
                });

                var grayscale = L.tileLayer('https://www.homeads.ca/tiles.php?z={z}&x={x}&y={y}&r=mapnik', {id: 'item-map', attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'}),
                    streets   = L.tileLayer('https://api.mapbox.com/styles/v1/dasiks/cjj63sw1b13pc2rozfpa49xh9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZGFzaWtzIiwiYSI6ImNqaHZ6OWs2bzBxcGEzcHBpMG12OTdsYzYifQ.d-r9F4KiUvsBcTseJSg3Ww' , {id: 'item-map', attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'});

                var mapPop = L.map('item-map', {
                    center: [data.data[0].wz, data.data[0].ez],
                    zoom: 14,
                    layers: [grayscale, marker],
                    zoomSnap:0.5
		    
                });

                var baseMaps = {
                    "Default": grayscale,
                    "Satelite": streets
                };


                L.control.layers(baseMaps).addTo(mapPop);

                var baseMaps = {
                    "<span style='color: gray'>Grayscale</span>": grayscale,
                    "Streets": streets
                };

                $(function(){
                    $('#calculator').homenote();

                    if ($('.container[data_id_p="' + x + '"] .price').text() !== '$') {
                        $('#purchasePrice').val($('.container[data_id_p="' + x + '"] .price').text().slice(1));
                    }
                });
            }
        }
    });
}

// bigPopupForm

function sendBigPopupForm () {

    var userBFName  = $('.cont-form input[name="user-first-name"]').val(),
        userBLName  = $('.cont-form input[name="user-last-name"]').val(),
        userBEmail  = $('.cont-form input[name="user-mail"]').val(),
        userBTel    = $('.cont-form input[name="user-tel"]').val(),
        userUrl    = $('.cont-form input[name="full-url"]').val(),
        userQuestion = $('.cont-form textarea[name="user-question"]').val(),
        userProp    = $('.cont-form input[name="view-prop"]').is(':checked');


    $('.cont-form input.error').removeClass('error');
    $('.cont-form .send-ok').addClass('hidden');

    if (userBFName === '') {
        $('.cont-form input[name="user-first-name"]').addClass('error');
    }

    if (userBLName === '') {
        $('.cont-form input[name="user-last-name"]').addClass('error');
    }

    if (userBEmail === '') {
        $('.cont-form input[name="user-mail"]').addClass('error');
    }

    if (userBTel === '') {
        $('.cont-form input[name="user-tel"]').addClass('error');
    }

    if (!$('.cont-form input.error').length) {
        $('.cont-form .send-preload').removeClass('hidden');

        $.post('/engine/bigPopupSendForm.php', {'userBFName': userBFName, 'userBLName': userBLName, 'userBEmail': userBEmail, 'userBTel': userBTel, 'userProp': userProp, 'userUrl': userUrl ,'userQuestion':userQuestion }, function (res) {
            if (res) {
                $('.cont-form .send-preload').addClass('hidden');
                $('.cont-form .send-ok').removeClass('hidden');
            } else {

            }
        });
    }

    //ga('send','event','conversion','request sent','lead',1,{'nonInteraction':true});
    ga(['_trackPageview', '/requestsentinfo.html']);
    console.log('done');
};

var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
};

var listing_ID = getUrlParameter('listing-id') || '',
    listing_price_from = getUrlParameter('pricefrom') || '',
    listing_price_to = getUrlParameter('priceto') || '';

if (listing_ID !== '') {
    openSuperBigPopoup (+listing_ID);
}


function getPopUpper(markerData) {
    var images = '';
    if (markerData[6]) {
        for (var i = 1; i <= markerData[6]; i++) {
            images += '<div class="item"><img onerror="this.onerror=null;this.src=\'/src/img/no-image.svg\';" src="https://www.homeads.ca/img/' + markerData[0] + '_' + i + '.jpg"></div>';
        }
    } else images = '<div class="no-image"></div>';


    return '<div class="info-popup">' +
        '   <div class="for-type">' + markerData[8] + '</div>' +
        '   <i class="mdi mdi-heart" data_house="' + markerData[0] + '" onclick="bookList(' + markerData[0] + ')"></i>' +
        '   <div class="slider-wrapper owl-carousel d-flex align-items-center">' + images + '</div>' +
        '   <div class="cont-wrap">' +
        '       <div>' +
        '           <span class="beds"><i class="mdi mdi-hotel"></i> ' + markerData[4] + '</span>' +
        '           <span class="bath"><i class="bath-icon"><img src="./images/Bathtub-512.jpg" alt=""></i> ' + markerData[5] + '</span>' +
        '       </div>' +
        '       <h3 class="info-popup-title">' + markerData[7] + '</h3>' +
        '       <div><span class="price">$' + markerData[3] + '</span></div>' +
        '   </div>' +
        '</div>';
}

function bindEventsToPopUpper(e) {

    $('.leaflet-popup-close-button').on('click', function() {
        $('.filter-type-wrapper, .map-regime-controller, .leaflet-control-zoom').removeClass('hidden');
        return false;
    });

    if ( window.innerWidth < 550 ) {
        $('.filter-type-wrapper, .map-regime-controller, .leaflet-control-zoom').addClass('hidden');
    }
    $('.cluster-popup-el').remove();
    var element = $(e.target._popup._contentNode);

    if (window.pageYOffset > 0) {
        $('html, body').animate({scrollTop: 0}, 500);
    };

    element.find(".info-popup-title").on('click', function () {
        openSuperBigPopoup(e.target.markerData[0]);
    });

    element.addClass("owl-done").find(".slider-wrapper").owlCarousel({
        loop: false,
        margin: 0,
        nav: true,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 1
            },
            1000: {
                items: 1
            }
        },
        navText: ["<i class='mdi mdi-chevron-left'></i>", "<i class='mdi mdi-chevron-right'></i>"]
    }).trigger('refresh.owl.carousel');

    map.setView(new L.LatLng(e.latlng.lat + 0.007, e.latlng.lng));

}


(function ($) {


    $(window).on('scroll', function () {
        reCalcPopUpCoord();
        $(".cluster-popup-el").remove();
    });

    $(document).ready(function () {

        if (residential !== '') {
            $('input[name="residential"]').attr('value', residential);
            $('input[name="residential"]').parent().find('.controller span').html($('input[name="residential"]').parent().find('li[data-val="' + residential + '"]').text());
        }

        $('.residential-wrapper li').on('click', function () {
            if (+$(this).attr('data-val') !== 0) {
                $('.sale-type-wrapper li[data-val="2"]').html('For lease');
            } else {
                $('.sale-type-wrapper li[data-val="2"]').html('For rent');
            }
        });

        if (homeType !== '') {
            $('input[name="home-type"]').attr('value', homeType);
            $('input[name="home-type"]').parent().find('.controller span').html($('input[name="home-type"]').parent().find('li[data-val="' + homeType + '"]').text());
        }

        if (landType !== '') {
            $('input[name="land-type"]').attr('value', landType);
            $('input[name="land-type"]').parent().find('.controller span').html($('input[name="land-type"]').parent().find('li[data-val="' + landType + '"]').text());
        }

        if (bstories !== '') {
            $('input[name="bstories"]').attr('value', bstories);
            $('input[name="bstories"]').parent().find('.controller span').html($('input[name="bstories"]').parent().find('li[data-val="' + bstories + '"]').text());
        }

        if (attachstyle !== '') {
            $('input[name="attachstyle"]').attr('value', attachstyle);
            $('input[name="attachstyle"]').parent().find('.controller span').html($('input[name="attachstyle"]').parent().find('li[data-val="' + attachstyle + '"]').text());
        }


        if (priceFrom !== '') {
            $('input[name="price-from"]').attr('value', priceFrom);
            $('input[name="price-from"]').parent().find('.controller span').html($('input[name="price-from"]').parent().find('li[data-val="' + priceFrom + '"]').text());
        }

        if (priceTo !== '') {
            $('input[name="price-to"]').attr('value', priceTo);
            $('input[name="price-to"]').parent().find('.controller span').html($('input[name="price-to"]').parent().find('li[data-val="' + priceTo + '"]').text());
        }

        if (rentFrom !== '') {
            $('input[name="rent-from"]').attr('value', rentFrom);
            $('input[name="rent-from"]').parent().find('.controller span').html($('input[name="rent-from"]').parent().find('li[data-val="' + rentFrom + '"]').text());
        }

        if (rentTo !== '') {
            $('input[name="rent-to"]').attr('value', rentTo);
            $('input[name="rent-to"]').parent().find('.controller span').html($('input[name="rent-to"]').parent().find('li[data-val="' + rentTo + '"]').text());
        }

        if (interioFrom !== '') {
            $('input[name="interio-from"]').attr('value', interioFrom);
            $('input[name="interio-from"]').parent().find('.controller span').html($('input[name="interio-from"]').parent().find('li[data-val="' + interioFrom + '"]').text());
        }

        if (interioTo !== '') {
            $('input[name="interio-to"]').attr('value', interioTo);
            $('input[name="interio-to"]').parent().find('.controller span').html($('input[name="interio-to"]').parent().find('li[data-val="' + interioTo + '"]').text());
        }

        if (dateD !== '') {
            $('#datepicker').attr('value', dateD);
        }

        if (beds !== '') {
            $('input[name="beds"]').attr('value', beds);
            $('input[name="beds"]').parent().find('.controller span').html(beds);
        }

        if (bath !== '') {
            $('input[name="bath"]').attr('value', bath);
            $('input[name="bath"]').parent().find('.controller span').html(bath);
        }

        if (openHouseOnly !== '') {
            $('input[name="openHouseOnly"]').attr('value', openHouseOnly);
            $('input[name="openHouseOnly"]').parent().find('.item-body').addClass('active');
        }

        if (waterfront !== '') {
            $('input[name="waterfront"]').attr('value', waterfront);
            $('input[name="waterfront"]').parent().find('.item-body').addClass('active');
        }

        if (pool !== '') {
            $('input[name="pool"]').attr('value', pool);
            $('input[name="pool"]').parent().find('.item-body').addClass('active');
        }

        if (fireplace !== '') {
            $('input[name="fireplace"]').attr('value', fireplace);
            $('input[name="fireplace"]').parent().find('.item-body').addClass('active');
        }

        $('.send-button').on('click', function(){
            var userName = $('.send-form input[name="S_user-name"]').val(),
                userMail = $('.send-form input[name="S_user-mail"]').val(),
                userPhone = $('.send-form input[name="S_user-phone"]').val();

            $('.send-form input.error').removeClass('error');
            $('.send-ok').addClass('hidden');

            if (userName === '') {
                $('.send-form input[name="S_user-name"]').addClass('error');
            }

            if (userMail === '') {
                $('.send-form input[name="S_user-mail"]').addClass('error');
            }

            if (userPhone === '') {
                $('.send-form input[name="S_user-phone"]').addClass('error');
            }

            if (!$('.send-form input.error').length) {
                $('.send-preload').removeClass('hidden');

                $.post('/engine/bookViewingSendForm.php', {'userName': userName, 'userMail': userMail, 'userPhone': userPhone, 'bookListId': JSON.stringify(bookListId) }, function (res) {
                    if (res) {
                        $('.send-preload').addClass('hidden');
                        $('.send-ok').removeClass('hidden');
                    } else {

                    }
                });
            }
        });

        if (bookListId.length != 0) {
            $('.book_viewing').addClass('items');
        }

        bricks = Bricks({
            container: $("#listings .masonry_cont")[0],
            packed: 'data-packed',
            position: true,
            sizes: [
                {columns: 5, gutter: 5},
                {mq: '230px', columns: 1, gutter: 20},
                {mq: '430px', columns: 4, gutter: 3},
                {mq: '768px', columns: 4, gutter: 3},
                {mq: '1199px', columns: 5, gutter: 6}
            ]
        });

        $('.select-regime-list').on('click', function () {
            $('.select-regime-marker').removeClass('active');
            $(this).addClass('active');
            askForPlots();


            $('.sort-button').css({
               display: 'block'
            });

            $('.map-regime-controller').css({
                top: '70px',
                position: 'fixed'
            });

            $('.cluster-popup-el').remove();
            $('.select-regime-marker').css({display: 'flex'});


            $('#listings').css({
                display: 'flex',
                zIndex: 2
            });
            $('.map-wrapper').css({
                position: "absolute",
                zIndex: 0
            });

            reBrick();

            $('.masonry_cont').css({
                opacity: 1
            });
        });

        $('.select-regime-marker').on('click', function () {
            $('.select-regime-list').removeClass('active');
            $(this).addClass('active');
            askForPlots();

            $('.sort-button').css({
                display: 'none'
            });
            $('.sort-wrapper ul.active').removeClass('active');

            $('.select-regime-list').css({display: 'flex'});
            $('.map-regime-controller').css({
                top: '20px',
                position: 'absolute'
            });

            $('#listings').css({
                display: 'none',
                zIndex: 0
            });
            $('.map-wrapper').css({
                position: "relative",
                zIndex: 1
            });

            if (window.pageYOffset > 0) {
                $('html, body').animate({scrollTop: 0}, 500);
            };

            return false;
        });

        // custom select

        $('.custom-select .controller').on('click', function() {

            var pointT = $(this).closest('.custom-select'),
                pointTu = pointT.find('ul'),
                pointTuH = $(pointT).offset().top - 55 - $(window).scrollTop(),
                pointTuHB = $(window).innerHeight() - 50 -$(pointT).offset().top;
            if (pointT.hasClass('active')) {
                $('.custom-select').removeClass('active');
            } else {
                $('.custom-select').removeClass('active');
                pointT.addClass('active');
                if (pointTuH < 100) {
                    pointTu.css({
                        top: '100%',
                        bottom: 'initial',
                        maxHeight: pointTuHB,
                    });
                } else {
                    pointTu.css({
                        top: 'initial',
                        bottom: '100%',
                        maxHeight: pointTuH,
                    });
                }

            }

            if ($('.more-option').hasClass('active')) {
                $('.more-option').removeClass('active');
            }

        });
        $('.custom-select .option li').on('click', function(){
            $(this).closest('.custom-select').find('.controller span').html($(this).text());
            $(this).closest('.custom-select').find('input').attr('value', $(this).attr('data-val'));
            $('.custom-select').removeClass('active');

            mapcluster.clearLayers();
            markers = {};
            askForPlots();
        });

        // custom checkbox

        $('.custom-checkbox .item-body').click(function() {
            $(this).toggleClass('active');
            if ($(this).hasClass('active')) {
                $(this).closest('.custom-checkbox').find('input').attr('value', true);
            } else {
                $(this).closest('.custom-checkbox').find('input').attr('value', false);
            }

            mapcluster.clearLayers();
            markers = {};
            askForPlots();
        });

        // datepicker

        $( function() {
            $( "#datepicker" ).datepicker({
                dateFormat: "dd-mm-yy",
                beforeShow:function(textbox, instance){
                    $('.datepicker').append($('#ui-datepicker-div'));
                }
            });
        });

        $('.datepicker').click(function () {
            $("#datepicker").datepicker( "show" );
        });

        $('.datepicker i').click(function () {
            $("#datepicker").datepicker('setDate', null);
            askForPlots();
            return false;
        });

        $('#datepicker').change(function () {
            mapcluster.clearLayers();
            markers = {};
            askForPlots();
        });

        // more-options

        $('.more-option .controller').on('click', function() {
            $(this).closest('.more-option').toggleClass('active');
        });

        // min-price

        $('.min-price li').on('click', function (){
            var maxPrice = $('.max-price li');

            for (var i = 0; i < maxPrice.length; i++) {
                if (+$(this).attr('data-val') >= +$(maxPrice[i]).attr('data-val')) {
                    $(maxPrice[i]).addClass('hidden')
                } else (
                    $(maxPrice[i]).removeClass('hidden')
                )
            }
        });

        // max-price

        $('.max-price li').on('click', function (){
            var minPrice = $('.min-price li');

            for (var i = 0; i < minPrice.length; i++) {
                if (+$(this).attr('data-val') <= +$(minPrice[i]).attr('data-val')) {
                    $(minPrice[i]).addClass('hidden')
                } else (
                    $(minPrice[i]).removeClass('hidden')
                )
            }
        });

        // min-rent

        $('.min-rent li').on('click', function (){
            var maxRent = $('.max-rent li');

            for (var i = 0; i < maxRent.length; i++) {
                if (+$(this).attr('data-val') >= +$(maxRent[i]).attr('data-val')) {
                    $(maxRent[i]).addClass('hidden')
                } else (
                    $(maxRent[i]).removeClass('hidden')
                )
            }
        });

        // max-rent

        $('.max-rent li').on('click', function (){
            var minRent = $('.min-rent li');

            for (var i = 0; i < minRent.length; i++) {
                if (+$(this).attr('data-val') <= $(minRent[i]).attr('data-val')) {
                    $(minRent[i]).addClass('hidden')
                } else (
                    $(minRent[i]).removeClass('hidden')
                )
            }
        });

        // min-interio

        $('.min-interio li').on('click', function (){
            var maxInterio = $('.max-interio li');

            for (var i = 0; i < maxInterio.length; i++) {
                if (+$(this).attr('data-val') >= +$(maxInterio[i]).attr('data-val')) {
                    $(maxInterio[i]).addClass('hidden')
                } else (
                    $(maxInterio[i]).removeClass('hidden')
                )
            }
        });

        // max-interio

        $('.max-interio li').on('click', function (){
            var minInterio = $('.min-interio li');

            for (var i = 0; i < minInterio.length; i++) {
                if (+$(this).attr('data-val') <= +$(minInterio[i]).attr('data-val')) {
                    $(minInterio[i]).addClass('hidden')
                } else (
                    $(minInterio[i]).removeClass('hidden')
                )
            }
        });

        // search

        $('.search-wrapper input').on('keyup', function () {
            searchValue = $(this).val();
            mapcluster.clearLayers();
            markers = {};
            askForPlots();
        });

        $('.sale-type-wrapper li').on('click', function() {
            if ($(this).attr('data-val') === '1') {
                $('.max-price, .min-price').removeClass('hidden');
                $('.max-rent, .min-rent').addClass('hidden');
                $('.filter-type').html('For sale <i class="mdi mdi-menu"></i>');
            } else {
                $('.max-price, .min-price').addClass('hidden');
                $('.max-rent, .min-rent').removeClass('hidden');
                $('.filter-type').html('For rent <i class="mdi mdi-menu"></i>');
            }
            return false;
        });
    });

    $(document).on('initMap', function (e, lat, lon, zoom) {
        map = new L.Map('map',{zoomSnap:0.2,wheelPxPerZoomLevel: 300, srs:3857});
        var osmUrl = 'https://www.homeads.ca/tiles.php?z={z}&x={x}&y={y}&r=mapnik';
        var osmAttrib = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
        var osm = new L.TileLayer(osmUrl, {minZoom: 10, maxZoom: 15, attribution: osmAttrib});

        map.setView(new L.LatLng(lat, lon), zoom);
        map.addLayer(osm);

        mapcluster = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 60,
            zoomToBoundsOnClick: false,
            spiderfyOnMaxZoom: false,
            showCoverageOnHover: false,
            iconCreateFunction: function(cluster) {
                return L.divIcon({ html: '<div class="cluster-wrapper"><i class="mdi mdi-home-alert"><div></div></i><span>' + cluster.getChildCount() + '</span></div>' });
            }
        });

        mapcluster.on('clusterclick', onMapClusterClick);

        map.addLayer(mapcluster);
        map.on('moveend', onMapMoveEnd);
        map.on('move', reCalcPopUpCoord);
        map.on('click', function () {
            $(".cluster-popup-el").remove();
            $('.filter-type-wrapper, .map-regime-controller, .leaflet-control-zoom').removeClass('hidden');
        });

        askForPlots();

    });

    function reBrick() {
        bricks.resize(true).pack().update();
    }

var proxy = '//maps.kosmosnimki.ru/ApiSave.ashx?WrapStyle=None&get=';
    function getFeatures(params) {
		L.gmx.getJSON(proxy + 'http://www.homeads.ca/engine/box.php' + encodeURIComponent(params), {type: 'json'})
			.then(function(json) {
				if (json.res && json.res.Status === 'ok') {
					gotPlots(JSON.parse(json.res.Result));
				}
		});

                // $.post('http://www.homeads.ca/engine/box.php' + params, {
                    // 'listing_price_from': listing_price_from,
                    // 'listing_price_to': listing_price_to,
                    // 'residential': $('input[name="residential"]').val(),
                    // 'homeType': $('input[name="home-type"]').val(),
                    // 'priceFrom': $('input[name="price-from"]').val(),
                    // 'priceTo': $('input[name="price-to"]').val(),
                    // 'rentFrom': $('input[name="rent-from"]').val(),
                    // 'rentTo': $('input[name="rent-to"]').val(),
                    // 'interioFrom': $('input[name="interio-from"]').val(),
                    // 'interioTo': $('input[name="interio-to"]').val(),
                    // 'dateD': $('#datepicker').val(),
                    // 'beds': $('input[name="beds"]').val(),
                    // 'bath': $('input[name="bath"]').val(),
                    // 'openHouseOnly': $('input[name="openHouseOnly"]').val(),
                    // 'waterfront': $('input[name="waterfront"]').val(),
                    // 'pool': $('input[name="pool"]').val(),
                    // 'fireplace': $('input[name="fireplace"]').val(),
                    // 'searchValue': searchValue,
                    // 'sortType': sortType,
                    // 'landType':  $('input[name="land-type"]').val(),
		    // 'bstories': $('input[name="bstories"]').val(),
		    // 'attachstyle': $('input[name="attachstyle"]').val()
                // }, function (data) {
                    // if (data) gotPlots(data);
                // });
	}
    function getBoxListings(params) {
		L.gmx.getJSON(proxy + 'http://www.homeads.ca/engine/boxlistings.php' + encodeURIComponent(params), {type: 'json'})
			.then(function(json) {
				if (json.res && json.res.Status === 'ok') {
					var res = JSON.parse(json.res.Result);
					$('.not_found').remove();

					var masonryWrapper = $("#listings .masonry_cont");
					masonryWrapper.children(".grid-item").remove();
					res.html = res.html.join("");
					masonryWrapper.html(res.html);

					if (res.html.length == 0) {
						$('.masonry_cont').append($('<div>', { class: 'not_found', text: 'Sorry, there are no listings to match your criteria. Please expand your criteria or move around the map to search in different location. Thank You.'}))
					}

					if ( window.innerWidth > 430 ) {
						reBrick();
					}
				}
		});
               // $.post('http://www.homeads.ca/engine/boxlistings.php' + params, {
                    // 'sortType':sortType,
                    // 'listing_price_from': listing_price_from,
                    // 'listing_price_to': listing_price_to,
                    // 'residential': $('input[name="residential"]').val(),
                    // 'homeType': $('input[name="home-type"]').val(),
                    // 'priceFrom': $('input[name="price-from"]').val(),
                    // 'priceTo': $('input[name="price-to"]').val(),
                    // 'rentFrom': $('input[name="rent-from"]').val(),
                    // 'rentTo': $('input[name="rent-to"]').val(),
                    // 'interioFrom': $('input[name="interio-from"]').val(),
                    // 'interioTo': $('input[name="interio-to"]').val(),
                    // 'dateD': $('#datepicker').val(),
                    // 'beds': $('input[name="beds"]').val(),
                    // 'bath': $('input[name="bath"]').val(),
                    // 'openHouseOnly': $('input[name="openHouseOnly"]').val(),
                    // 'waterfront': $('input[name="waterfront"]').val(),
                    // 'pool': $('input[name="pool"]').val(),
                    // 'fireplace': $('input[name="fireplace"]').val(),
                    // 'searchValue': searchValue,
                    // 'sortType': sortType,
                    // 'landType':  $('input[name="land-type"]').val(),
		    // 'bstories': $('input[name="bstories"]').val(),
		    // 'attachstyle': $('input[name="attachstyle"]').val()
                // },function (res) {
                    // if (res) {

                        // $('.not_found').remove();

                        // masonryWrapper.children(".grid-item").remove();
                        // res.html = res.html.join("");
                        // masonryWrapper.html(res.html);

                        // if (res.html.length == 0) {
                            // $('.masonry_cont').append($('<div>', { class: 'not_found', text: 'Sorry, there are no listings to match your criteria. Please expand your criteria or move around the map to search in different location. Thank You.'}))
                        // }

                        // if ( window.innerWidth > 430 ) {
                            // reBrick();
                        // }
                    // }
                // });

	}

    function askForPlots() {
        var bounds = map.getBounds();
        var minll = bounds.getSouthWest();
        var maxll = bounds.getNorthEast();
        var params = '?w=' + minll.lng + '&s=' + minll.lat + '&e=' + maxll.lng + '&n=' + maxll.lat;

        // var masonryWrapper = $("#listings .masonry_cont");

        if ( window.innerWidth < 768 ) {

            if ($('.select-regime-marker').hasClass('active')) {
				getFeatures(params);
            } else {
				getBoxListings(params);
            }

        } else {
			getBoxListings(params);
			getFeatures(params);
            // $.post('/engine/boxlistings.php' + params, {
                // 'sortType': sortType,
                // 'listing_price_from': listing_price_from,
                // 'listing_price_to': listing_price_to,
                // 'residential': $('input[name="residential"]').val(),
                // 'homeType': $('input[name="home-type"]').val(),
                // 'priceFrom': $('input[name="price-from"]').val(),
                // 'priceTo': $('input[name="price-to"]').val(),
                // 'rentFrom': $('input[name="rent-from"]').val(),
                // 'rentTo': $('input[name="rent-to"]').val(),
                // 'interioFrom': $('input[name="interio-from"]').val(),
                // 'interioTo': $('input[name="interio-to"]').val(),
                // 'dateD': $('#datepicker').val(),
                // 'beds': $('input[name="beds"]').val(),
                // 'bath': $('input[name="bath"]').val(),
                // 'openHouseOnly': $('input[name="openHouseOnly"]').val(),
                // 'waterfront': $('input[name="waterfront"]').val(),
                // 'pool': $('input[name="pool"]').val(),
                // 'fireplace': $('input[name="fireplace"]').val(),
                // 'searchValue': searchValue,
                // 'sortType': sortType,
                // 'landType':  $('input[name="land-type"]').val(),
	        // 'bstories': $('input[name="bstories"]').val(),
 	        // 'attachstyle': $('input[name="attachstyle"]').val()
            // },function (res) {
                // if (res) {

                    // $('.not_found').remove();

                    // masonryWrapper.children(".grid-item").remove();
                    // res.html = res.html.join("");
                    // masonryWrapper.html(res.html);

                    // if (res.html.length == 0) {
                        // $('.masonry_cont').append($('<div>', { class: 'not_found', text: 'Sorry, there are no listings to match your criteria. Please expand your criteria or move around the map to search in different location. Thank You.'}))
                    // }

                    // if ( window.innerWidth > 430 ) {
                        // reBrick();
                    // }
                // }
            // });

            // $.post('/engine/box.php' + params, {
                // 'listing_price_from': listing_price_from,
                // 'listing_price_to': listing_price_to,
                // 'residential': $('input[name="residential"]').val(),
                // 'homeType': $('input[name="home-type"]').val(),
                // 'priceFrom': $('input[name="price-from"]').val(),
                // 'priceTo': $('input[name="price-to"]').val(),
                // 'rentFrom': $('input[name="rent-from"]').val(),
                // 'rentTo': $('input[name="rent-to"]').val(),
                // 'interioFrom': $('input[name="interio-from"]').val(),
                // 'interioTo': $('input[name="interio-to"]').val(),
                // 'dateD': $('#datepicker').val(),
                // 'beds': $('input[name="beds"]').val(),
                // 'bath': $('input[name="bath"]').val(),
                // 'openHouseOnly': $('input[name="openHouseOnly"]').val(),
                // 'waterfront': $('input[name="waterfront"]').val(),
                // 'pool': $('input[name="pool"]').val(),
                // 'fireplace': $('input[name="fireplace"]').val(),
                // 'searchValue': searchValue,
                // 'sortType': sortType,
                // 'landType':  $('input[name="land-type"]').val(),
    	        // 'bstories': $('input[name="bstories"]').val(),
   	        // 'attachstyle': $('input[name="attachstyle"]').val()
            // }, function (data) {
                // if (data) gotPlots(data);
            // });
        }
    }

    // function appendBoxListing(masonryWrapper, data, time) {
    //     setTimeout(function () {
    //         var toUpdate = false;
    //         for (var i = 0; i < data.length; i++) {
    //             if (!masonryWrapper.children(".grid-item[data-id='" + data[i].id + "']").length && availableBoxListings.indexOf(data[i].id) >= 0) {
    //                 masonryWrapper.append($(data[i].html).data('marker', data[i].markerData));
    //                 toUpdate = true;
    //             }
    //         }
    //
    //         if (toUpdate) reBrick();
    //     }, time);
    // }

    function reCalcPopUpCoord() {
        $(".cluster-popup-el").each(function () {
            var screenCoords = map.layerPointToContainerPoint(map.latLngToLayerPoint($(this).data('claster-coords')));
            $(this).css({
                top: screenCoords.y - $(window).scrollTop() - 50,
                left: screenCoords.x - $(this).outerWidth() / 2
            });
        });
    }

    function onMapMoveEnd(e) {

       // cancel any timeout currently running
	window.clearTimeout(timeoutHandler);
	// create new timeout to fire sesarch function after 500ms (or whatever you like)
	timeoutHandler = window.setTimeout(function() {
	        askForPlots();
	        if (window.pageYOffset > 0) {
	            $('html, body').animate({scrollTop: 0}, 500);
	        }
	
	        if ($('#listings .content').length !== 0) {
	            $('#listings .content').remove();
	            var headerHeight = $('header').outerHeight(),
	                listContent = $('#listings .content').height() || 0;
	            $('.masonry_cont_wrapper').height($(window).innerHeight() - headerHeight - listContent + 'px');
	        }
	
	        $('.masonry_cont').css({
	           paddingRight: '15px',
	           overflow: 'hidden',
	        });
	        document.querySelector('.masonry_cont').scrollTop = 0;
	}, 1100);	





    }

    function onMapClusterClick(e) {

        $('.cluster-popup-el').remove();
        $('.filter-type-wrapper, .map-regime-controller, .leaflet-control-zoom').removeClass('hidden');

        if (map._animateToZoom >= 15) {

            map.setView(e.latlng, map.getZoom());

            var markers = e.layer.getAllChildMarkers(),
                container = $('<div>', {class: 'cluster-popup-el'})
                .data('claster-coords', e.latlng),
                cont = '';

            for (var i = 0; i < markers.length; i++) {
                var element = $(markers[i].suttonPopupElement);

                cont += '<div class="items d-flex" data_id="' + markers[i].markerData[0] + '">' +
                            '<div class="items-img-wrapper">' +
                                '<img  onclick="openSuperBigPopoup($(this).closest(\'[data_id]\').attr(\'data_id\'))" src="https://www.homeads.ca/img_thumbs/' + markers[i].markerData[0] + '_1.jpg" onerror="this.onerror=null;this.src=\'/src/img/no-image.svg\';">' +
                                '<i onclick="bookList($(this).attr(\'data_house\'))" class="mdi mdi-heart" data_house="' + markers[i].markerData[0] + '"></i>' +
                                '<div class="for-type">' + markers[i].markerData[8] + '</div>' +
                            '</div>' +
                            '<div class="items-content-wrapper d-flex flex-column">' +
                                '<h3 onclick="openSuperBigPopoup($(this).closest(\'[data_id]\').attr(\'data_id\'))">' + element.find('h3').text() + '</h3>' +
                                '<div class="d-flex">' +
                                    '<span class="beds"><i class="mdi mdi-hotel"></i> ' + element.find('.beds').text() + '</span>' +
                                    '<span class="bath"><i class="bath-icon"><img src="./images/Bathtub-512.jpg" alt=""></i> ' + element.find('.bath').text() + '</span>' +
                                '</div>' +
                                '<div>' +
                                    '<span class="price">' + element.find('.price').text() + '</span>' +
                                '</div>' +
                            '</div>' +
                        '</div>';
            }

            $(container)[0].innerHTML = cont;

            $('body').append(container);
            reCalcPopUpCoord();
            var psC = new PerfectScrollbar('.cluster-popup-el',{
                suppressScrollX: true,
                wheelPropagation: false,
            });

        } else {
            e.layer.zoomToBounds();
        }
    }

    function gotPlots(plotlist) {
		var markersCurrent = plotlist.map(function(it) {
            var id = it[0],
				marker = markers[id];
            if (!marker) {
				marker = markers[id] = L.marker(L.latLng(it[1], it[2]), {
					icon: new L.DivIcon({
						className: 'tooltips',
						iconAnchor: [43, 32],
						shadowSize:   [0, 0],
						shadowAnchor: [0, 0],
						popupAnchor:  [3, 6],
						html: '' +
						'<div class="triangle" id="' + it[0] + '"><strong>$' + it[3] + '</strong></div>'
					})
				});
				var popup = getPopUpper(it);
				marker.suttonPopupElement = popup;
				marker.markerData = it;
				marker.bindPopup(popup);
				marker.on('click', bindEventsToPopUpper);
			}
			return marker;
		});
		mapcluster.clearLayers();
		mapcluster.addLayers(markersCurrent);
        // for (var i = 0; i < plotlist.length; i++) {
            // var markerData = plotlist[i];

            // if (markers[markerData[0]]) continue;

            // var marker = L.marker(L.latLng(markerData[1], markerData[2]), {
                // icon: new L.DivIcon({
                    // className: 'tooltips',
                    // iconAnchor: [43, 32],
                    // shadowSize:   [0, 0],
                    // shadowAnchor: [0, 0],
                    // popupAnchor:  [3, 6],
                    // html: '' +
                    // '<div class="triangle" id="' + markerData[0] + '"><strong>$' + markerData[3] + '</strong></div>'
                // })
            // });

            // var popup = getPopUpper(markerData);
            // marker.suttonPopupElement = popup;
            // marker.markerData = markerData;
            // marker.bindPopup(popup);
            // marker.on('click', bindEventsToPopUpper);

            // markers[markerData[0]] = marker;
            // mapcluster.addLayer(marker);
        // }
    }

    
    $('.sort-wrapper ul li').on('click', function() {
        $('.sort-wrapper ul').removeClass('active');
        return false;
    });

    $('.controller i.mdi-delete-forever').on('click', function() {
        bookListId = [];
        localStorage.removeItem('bookListId');
        $('.book_viewing').removeClass('items');
        $('.container_viewing').removeClass('active');
        $('body').css({overflowY: 'inherit'});
        $('i[data_house]').removeClass('active');
    });

    $('.controller i.mdi-close-box-outline').on('click', function() {
        $('.container_viewing').removeClass('active');
        $('body').css({overflowY: 'inherit'});
    });

    $('.book_viewing').on('click', function(e) {
        e.preventDefault();
        if ($(this).hasClass('items')) {
            $('body').css({overflowY: 'hidden'});
            $('.container_viewing .result-cont .items').remove();

            $.ajax({
                type: "POST",
                url: "/engine/bookViewing.php",
                data: {
                    'bookListId': JSON.stringify(bookListId),
                },
                dataType: "json",
                success: function(data){
                    if (data){
                        var contentD = '';
                        for (var i = 0; i < data.length; i++) {
                            contentD += data[i];
                        }

                        cont.html(contentD);
                        $('.container_viewing').toggleClass('active');
                        $('.items-img-wrapper i').on('click', function() {

                            if ($('.result-cont .items').length - 1 === 0 ) {
                                $('.controller i.mdi-delete-forever').trigger('click');
                            } else {
                                var delId = $(this).closest('.items').attr('data-view-id');
                                $(this).closest('.items').remove();
                                $('[data_house="' + delId + '"]').removeClass('active');
                                if ($.inArray(delId, bookListId)) {
                                    bookListId.splice($.inArray(delId, bookListId), 1);
                                    localStorage.setItem('bookListId', JSON.stringify(bookListId));
                                }
                            }
                            return false;
                        })
                    }else{

                    }
                }
            });

            var psBo = new PerfectScrollbar('.result-cont',{
                suppressScrollX: true,
                wheelPropagation: false
            });

        } else {
            return false;
        }
    });

    $('.sort-rate').on('click', function () {
        $('.sort-rate').removeClass('active');
        $(this).addClass('active');
        sortType = $(this).attr('data-rate');

        var bounds = map.getBounds();
        var minll = bounds.getSouthWest();
        var maxll = bounds.getNorthEast();
        var params = '?w=' + minll.lng + '&s=' + minll.lat + '&e=' + maxll.lng + '&n=' + maxll.lat;

        var masonryWrapper = $("#listings .masonry_cont");
        $.post('/engine/boxlistings.php' + params, {
            'listing_price_from': listing_price_from,
            'listing_price_to': listing_price_to,
            'residential': $('input[name="residential"]').val(),
            'homeType': $('input[name="home-type"]').val(),
            'priceFrom': $('input[name="price-from"]').val(),
            'priceTo': $('input[name="price-to"]').val(),
            'rentFrom': $('input[name="rent-from"]').val(),
            'rentTo': $('input[name="rent-to"]').val(),
            'interioFrom': $('input[name="interio-from"]').val(),
            'interioTo': $('input[name="interio-to"]').val(),
            'dateD': $('#datepicker').val(),
            'beds': $('input[name="beds"]').val(),
            'bath': $('input[name="bath"]').val(),
            'openHouseOnly': $('input[name="openHouseOnly"]').val(),
            'waterfront': $('input[name="waterfront"]').val(),
            'pool': $('input[name="pool"]').val(),
            'fireplace': $('input[name="fireplace"]').val(),
            'searchValue': searchValue,
            'sortType': sortType,
            'landType': $('input[name="land-type"]').val(),
	    'bstories': $('input[name="bstories"]').val(),
	    'attachstyle': $('input[name="attachstyle"]').val()

        }, function (res) {
            if (res) {

                $('.not_found').remove();

                masonryWrapper.children(".grid-item").remove();
                masonryWrapper.html(res.html);

                if (res.html.length == 0) {
                    $('.masonry_cont').append($('<div>', { class: 'not_found', text: 'Sorry, there are no listings to match your criteria. Please expand your criteria or move around the map to search in different location. Thank You.'}))
                }

                if ( window.innerWidth > 430 ) {
                    reBrick();
                }
            } else {

            }
        });
    });

})(jQuery);