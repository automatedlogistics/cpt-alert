import 'jquery.cookie';

Date.prototype.stdTimezoneOffset = function () {
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

Date.prototype.dst = function () {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
};

(function ($) {
    'use strict';

    var hidden_alerts = [],
        date = new Date(),
        utc = date.getTime() + (date.getTimezoneOffset() * 60000),
        timezone_date = new Date(utc + (3600000 * '-5.0')),
        daylight_savings = timezone_date.dst(),
        current_time = force_leading_zero(timezone_date.getHours() + (daylight_savings ? 1 : 0)) + ':' +
            force_leading_zero(timezone_date.getMinutes());

    function init() {

        var $alert_containers = $('.als-alerts-container');

        if (!$alert_containers.length) {
            return;
        }

        $alert_containers.each(load_alerts);

        // Close alerts
        $(document).on('click', '.als-alert-close', function (e) {

            e.preventDefault();
            close_inset($(this).closest('.als-alert'));
            return false;
        });

        // Close popup on clicking outside
        $(document).on('click', '.als-alert.pop-up .als-alert-container', function () {
            close_popup($(this).closest('.als-alert'));
        });

        $(document).on('click', '.als-alert-content', function (e) {
            e.stopPropagation();
        });
    }

    function load_alerts(e) {

        var data = $(this).data(),
            $alert_container = $(this);

        data.action = 'als_alert_get_alerts';

        $.ajax( {
			type : 'POST',
            url : ALS_Alerts.ajaxurl,
            data : data,
            success : function (response) {

                var i, alert, $alert, alert_ID, time_start, time_end;

                if (!response['success'] || !response['data']['alerts'] || response['data']['alerts'].length == 0 ) {
                    return;
                }
				
				// Give us a way to easily know if there are actually alerts loaded from the top-most DOM element
				$alert_container.attr( 'data-has_alerts', true );

                for (i = 0; i < response['data']['alerts'].length; i++) {

                    alert = response['data']['alerts'][i];

                    alert_ID = 'als-alert-' + alert['post_ID'];

                    // Skip if hidden via cookie
                    if ($.cookie(alert_ID)) {
                        hidden_alerts.push(alert_ID);
                        continue;
                    }

                    // Hide for/if time range
                    if (alert['time_range']) {

                        // Force zero-leading
                        alert['time_range']['start']['hrs'] = force_leading_zero(alert['time_range']['start']['hrs']);
                        alert['time_range']['start']['min'] = force_leading_zero(alert['time_range']['start']['min']);

                        alert['time_range']['end']['hrs'] = force_leading_zero(alert['time_range']['end']['hrs']);
                        alert['time_range']['end']['min'] = force_leading_zero(alert['time_range']['end']['min']);

                        // Construct times
                        time_start = alert['time_range']['start']['hrs'] + ':' + alert['time_range']['start']['min'] + ':00';
                        time_end = alert['time_range']['end']['hrs'] + ':' + alert['time_range']['end']['min'] + ':00';
                        current_time = current_time + ':00';

                        // Make sure current time is between start and end times
                        if (current_time < time_start || current_time > time_end) {
                            continue;
                        }
                    }

                    if ( typeof alert.type == 'undefined' || ! alert.type ) {
                        alert.type = 'inset-banner';
                    }

                    $alert = build_alert(alert, $alert_container);

                    $alert_container.append($alert);

					$alert.slideDown();
					
                }
            },
			error : function( request, status, error ) {
				console.error( request.responseText );
				console.error( error );
			}
		} ); 

    }

    function build_alert(alert, $alert_container) {

        var $alert = $alert_container.find('.als-alert-dummy.' + alert['type']).clone(),
            $alert_button = $alert.find('.als-alert-button');

        $alert.attr('id', 'als-alert-' + alert['post_ID'])
            .addClass(alert['color'] + '-background')
            .removeClass('als-alert-dummy');

        $alert.find('.als-alert-text').append(alert['content']);
        $alert.find('.als-alert-icon').addClass(alert['icon']);

        if (alert['user_interaction'] == 'close_button' || alert['user_interaction'] == 'call_to_action') {

            $alert_button.html(alert['button_text'])
                .attr('href', alert['button_link']);

            if (alert['user_interaction'] == 'close_button') {

                $alert_button.addClass('als-alert-close');
                $alert_button.prepend('<span class="fa fa-times" aria-hidden="true"></span>');
            }

            if ( alert['button_new_tab'] == 1 ) {
                $alert_button.attr('target', '_blank');
            }
			
			if ( alert['user_interaction'] == 'call_to_action' ) {
				$alert_button.addClass( 'call-to-action' );
			}
			else if ( alert['user_interaction'] == 'close_button' ) {
				$alert_button.addClass( 'close-button' ).attr( 'aria-label', ALS_Alerts.closeButton );
			}
			
        }

        if (alert['type'] == 'pop-up') {
			
            $alert.find('.als-alert-image.show-for-medium').append('<img src="' + alert['popup_image'] + '" />');
			
			if ( alert['popup_image_small'].length <= 0 ) {
				$alert.find('.als-alert-image.show-for-small-only').css( 'display', 'none' );
			}
			else {
				$alert.find('.als-alert-image.show-for-small-only').append('<img src="' + alert['popup_image_small'] + '" />');
			}
			
			if ( alert['user_interaction'] == 'call_to_action' ) {
			
				// Create an additional Button and place it as needed for a Close Button
				$alert.find( '.als-alert-content' ).append( $alert_button.first().clone().removeClass( 'call-to-action' ).addClass( 'close-button' ).addClass( 'als-alert-close' ).html( '' ).prepend('<span class="fa fa-times" aria-hidden="true"></span>').attr( 'href', '' ).attr( 'aria-label', ALS_Alerts.closeButton ) );
				
			}
			else if ( alert['user_interaction'] == 'close_button' ) {
				
				// We don't want this for Mobile "Pop Ups"
				var $container = $alert_button.closest( '.show-for-small-only' );
				
				// Move the Close Button to where we want it
				$alert_button.first().detach().appendTo( $alert.find( '.als-alert-content' ) );
				
				$container.remove();
				
			}
			
        }
		
		// Don't show empty buttons
		if ( alert['user_interaction'] !== 'close_button' && 
			( alert['button_link'] == '' || alert['button_text'] == '' ) ) {
			$alert_button.remove();
		}

        return $alert;
    }

    function close_inset($alert) {


        // Banner
        if ($alert.hasClass('inset-banner')) {
            $alert.slideUp(400, function () {

                $.cookie($(this).attr('id'), 1);

                $(this).remove();
				restore_focus();
            });
        }

        // Pop-up
        if ($alert.hasClass('pop-up')) {
            close_popup($alert);
        }
    }

    function close_popup($alert) {

        $alert.find('.als-alert-content').slideUp(400, function () {
            $alert.fadeOut(400, function () {

                $.cookie($(this).attr('id'), 1);
                $(this).remove();
				restore_focus();
            });
        });
    }

    function force_leading_zero(string) {

        string = '0' + string;
        string = string.slice(string.length - 2);

        return string;
    }
	
	function restore_focus() {
		
		if ( typeof window.als_get_screen_size == 'function' && 
		   window.als_get_screen_size() == 'small' ) {
			$( '.header-container button:first-of-type' ).first().focus();
		}
		else {
			$( '.primary-nav ul li:first-of-type a' ).first().focus();
		}
		
	}

    if (ALS_Alerts) {
        $(init);
    }

    window['als_clear_alert_cookies'] = function () {

        if (hidden_alerts) {

            for (var i = 0; i < hidden_alerts.length; i++) {
                $.removeCookie(hidden_alerts[i]);
            }

            return 'All alerts on page have been reset! Please refresh page.';

        } else {
            return 'No alerts to reset.';
        }
    };
})(jQuery);