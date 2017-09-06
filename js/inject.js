var customEvent = document.createEvent('Event');
customEvent.initEvent('TRACK_WITH_EVENT_FOUND', true, true);

function fireCustomEvent(data) {
    hiddenDiv = document.getElementById('leonard_inject');
    if(hiddenDiv){
	    hiddenDiv.innerText = data
	    hiddenDiv.dispatchEvent(customEvent);
    }
}

/*
    Listening XHR for track event
*/

var requestCame = false, salesRequest = false;

XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(a, b, c){
    if(a == 'POST' && b.indexOf('track') > 0){
        requestCame = true;
    }
    if(a == 'POST' && b.indexOf('trackAction') > 0){
    	requestCame = true;
    	salesRequest = true;
    }
    this._open(a, b, c);
}

XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(param){
    if( (requestCame && param && param.indexOf('ControlInteractionEvent') > 0) || salesRequest){
        requestCame = false;
        salesRequest = false;
        fireCustomEvent(param);
    }
    this._send(param);
}