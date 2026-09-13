jQuery(document).ready(function($) {

	var my_nav = $('.navbar-sticky'); 
	var themeToggle = $('#theme-toggle');
	// grab the initial top offset of the navigation 
	var sticky_navigation_offset_top = my_nav.offset().top;
	
	// our function that decides weather the navigation bar should have "fixed" css position or not.
	var sticky_navigation = function(){
		var scroll_top = $(window).scrollTop(); // our current vertical position from the top
		
		// if we've scrolled more than the navigation, change its position to fixed to stick to top, otherwise change it back to relative
		if (scroll_top > sticky_navigation_offset_top) { 
			my_nav.addClass( 'stick' );
		} else {
			my_nav.removeClass( 'stick' );
		}   
	};

	var initio_parallax_animation = function() { 
		$('.parallax').each( function(i, obj) {
			var speed = $(this).attr('parallax-speed');
			if( speed ) {
				var background_pos = '-' + (window.pageYOffset / speed) + "px";
				$(this).css( 'background-position', 'center ' + background_pos );
			}
		});
	}
	
	// The redesigned pages (index.html/project-detail.html) are dark by
	// default now, so the toggle's job is to switch TO the light variant —
	// body.light-theme, defined in assets/css/theme.css — rather than into a
	// dark one. The icon reflects the CURRENT theme (🌙 while dark, ☀️ once
	// switched to light), matching the button's starting icon in the HTML.
	var toggleTheme = function() {
		$('body').toggleClass('light-theme');
		var isLight = $('body').hasClass('light-theme');
		themeToggle.text(isLight ? '☀️' : '🌙');
	};

	// run our function on load
	sticky_navigation();
	
	// and run it again every time you scroll
	$(window).scroll(function() {
		 sticky_navigation();
		 initio_parallax_animation();
	});

	themeToggle.on('click', toggleTheme);

});