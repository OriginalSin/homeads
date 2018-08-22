;(function () {
    $(document).ready(function () {

        // slider
        if ($('.featured_properties-slider').length) {
            $('.featured_properties-slider').owlCarousel({
                loop:true,
                margin:10,
                nav:true,
                responsive:{
                    0:{
                        items:1
                    },
                    600:{
                        items:3
                    },
                    1000:{
                        items:5
                    }
                },
                navText : ["<i class='mdi mdi-chevron-left'></i>","<i class='mdi mdi-chevron-right'></i>"]
            })
        }

        if ($('.featured_properties-slider2').length) {
            $('.featured_properties-slider2').owlCarousel({
                loop:true,
                margin:10,
                nav:false,
                dots: false,
                responsive:{
                    0:{
                        items:1
                    },
                    600:{
                        items:3
                    },
                    1000:{
                        items:5
                    }
                },
                navText : ["<i class='mdi mdi-chevron-left'></i>","<i class='mdi mdi-chevron-right'></i>"]
            })
        }

        $('.home_slider-wrapper .scroll-down').on('click', function() {
        var elt = $('.about_me-wrapper').offset().top;
            $('html, body').animate({scrollTop: elt}, 500);
        });

        // menu

        $('.menu-button').on('click', function(){
            $('.main_nav-wrapper').addClass('active');
        });

        $('.menu-closer').on('click', function(){
            $('.main_nav-wrapper').removeClass('active');
        });

        $('.menu-lists > li').on('click', function() {
            if ( window.innerWidth < 1135 ) {

                $('.sub-menu').css({
                    'max-height': $(window).innerHeight() - $('.main-nav-wr').innerHeight() - $('.contacts-wr').innerHeight() - 20
                });

                $('.sub-menu').each(function() {
                    if (!$($(this)[0]).hasClass('ps')) {
                        var psSub = new PerfectScrollbar($(this)[0],{
                            suppressScrollX: true,
                            wheelPropagation: false
                        });
                    }
                });

                if ($(this).find('.sub-menu').hasClass('openSub')) {
                    $('.sub-menu').removeClass('openSub');
                } else {
                    $('.sub-menu').removeClass('openSub');
                    $(this).find('.sub-menu').toggleClass('openSub');
                }
            }
        });

        $('.main_nav-wrapper').on('click', function(e) {
            if (!$(e.target).closest('li.have-sub-menu').length) {
                $('.sub-menu').removeClass('openSub');
            }
        });

        $(document).keydown(function(e) {
            switch(e.which) {
                case 37:
                    if ($('.cluster-popup-more-wrapper').length && $('.gallery-popup').hasClass('hidden')) {

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

                    }

                    if ($('.gallery-popup').hasClass('active')) {
                        $('.gallery-popup .carousel-wrap').trigger('prev.owl.carousel');
                    }
                    break;

                case 39:
                    if ($('.cluster-popup-more-wrapper').length && $('.gallery-popup').hasClass('hidden')) {

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

                    }

                    if ($('.gallery-popup').hasClass('active')) {
                        $('.gallery-popup .carousel-wrap').trigger('next.owl.carousel');
                    }
                    break;

                default: return;
            }
            e.preventDefault();
        });

    });

})(jQuery);