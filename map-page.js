;(function () {

    $(document).ready(function () {

        var headerHeight = $('header').outerHeight(),
            listContent = $('#listings .content').height() || 0;

        if ( window.innerWidth > 768 ) {
            $('.masonry_cont_wrapper').height($(window).innerHeight() - headerHeight - listContent - 23 + 'px');
            var bricks = Bricks({
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

            bricks.resize(true).pack().update();

            $('.masonry_cont').css({
               opacity: 1
            });

            var ps = new PerfectScrollbar('.masonry_cont',{
                suppressScrollX: true,
                wheelPropagation: false
            });
        }

        if ($('.instruction-slider').length) {
            $('.instruction-slider').owlCarousel({
                loop: false,
                margin: 10,
                nav: true,
                dots: false,
                responsive: {
                    0:{
                        items:1
                    },
                    600:{
                        items:1
                    },
                    1000:{
                        items:1
                    }
                },
                navText : ["Prev","Next"]
            })
        }

        $(window).on('resize', function(){

            var headerHeight = $('header').outerHeight(),
                listContent = $('#listings .content').outerHeight() || 0;

            $('.masonry_cont_wrapper').height($(window).innerHeight() - headerHeight - listContent + - 45 + 'px');

            if ( window.innerWidth < 768 ) {
                $('.masonry_cont_wrapper').height('auto');
                if (ps !== 's') {
                    ps.destroy();
                    ps = 's'
                }
            } else {
                $('.masonry_cont_wrapper').height($(window).innerHeight() - headerHeight - listContent + 'px');

                if (ps === 's') {
                    ps = new PerfectScrollbar('.masonry_cont', {
                        suppressScrollX: true,
                        wheelPropagation: false
                    });
                }
            }

        });

        $(document).on('click', function(e) {
            if (!$(e.target).closest('.filter-options').length && !$(e.target).closest('#ui-datepicker-div').length && !$(e.target).closest('.ui-datepicker-next').length && !$(e.target).closest('.ui-datepicker-prev').length) {
                $('.filter-options').removeClass('active');
            }

            if (!$(e.target).closest('.sort-wrapper ul').length) {
                $('.sort-wrapper ul').removeClass('active');
            }

            if (!$(e.target).closest('.sort-wrapper-desctop ul').length) {
                $('.sort-wrapper-desctop ul').removeClass('active');
            }

            if (!$(e.target).closest('.popup-instr').length) {
                $('.popup-instr-wrapper').remove();
            }

            if (!$(e.target).closest('.container_viewing .result').length) {
                $('.container_viewing').removeClass('active');
                $('.send-form input.error').removeClass('error');
            }

            if (!$(e.target).closest('.custom-select').length) {
                $('.custom-select').removeClass('active');
            }

            if (!$(e.target).closest('.more-option').length) {
                $('.more-option').removeClass('active');
            }

            if (!$(e.target).closest('.cluster-popup-more-wrapper .container').length) {
                $('body .cluster-popup-more-wrapper').remove();
                $('body').css({
                    overflowY: 'initial'
                });
            }
        });

        $('.filter-button, .filter-type').on('click', function() {
            $('.filter-options').toggleClass('active');
            return false;
        });

        $('.filter-options .filter-closer').on('click', function() {
            $('.filter-options').removeClass('active');
            return false;
        });

        $('.sort-button').on('click', function() {
            $('.sort-wrapper ul').addClass('active');
            return false;
        });

        $('.sort-button-mobile').on('click', function() {
            $('.sort-wrapper-desctop ul').toggleClass('active');
            return false;
        });

        $('.sort-types li').on('click', function() {
            $(this).parent().removeClass('active');
            $('li[data-rate="' + $(this).attr('data-rate') + '"]').addClass('active');
            return false;
        });

        $('.popup-instr-closer').on('click', function() {
            $('.popup-instr-wrapper').remove();
            return false;
        });

    });

})(jQuery);