

class BlanketLoader {
	initialize(){
		if($('#loadingBlanket').length==0){
			$('body').append(`
				<style>
					#loadingBlanket h1:empty::after{
						content:'Loading...'
					}
				</style>
				<div id='loadingBlanket'
					style='position: fixed;
						width: 100%;
						height: 100%;
						top: 0;
						left: 0;
						background-color: #0002;
						z-index: 1;
						display: none;'>
					<h1 style='position: absolute;
								top: 50%;
								left: 50%;
								transform: translate(-50%,-50%);
								text-shadow: 0 0 4px white;'></h1>
				</div>
			`);
		}
	}
	show(){
		$('#loadingBlanket').show();
		$('html').css('overflow','hidden');
	}
	hide(){
		$('#loadingBlanket').hide();
		$('html').css('overflow','auto');
	}
	moveToTop(){
		let highestZIndex = 0;
		$.each($("#loadingBlanket").siblings(), function (key, value) {
			let zIndex = parseInt($(value).css('z-index'));
			if (!Number.isInteger(zIndex)) return;
			if (highestZIndex < zIndex) highestZIndex = zIndex;
		});
		if ($("#loadingBlanket").css('z-index') < highestZIndex) {
			$("#loadingBlanket").css('z-index', highestZIndex + 1);
		}
	}
}

export default BlanketLoader;